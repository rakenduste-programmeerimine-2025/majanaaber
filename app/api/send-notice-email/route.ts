import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const MOCK_EMAIL = true

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return text.replace(/[&<>"']/g, char => htmlEntities[char])
}

export async function POST(request: Request) {
  try {
    const { notice_id, building_id } = await request.json()

    if (!notice_id || !building_id) {
      return NextResponse.json(
        { error: "Missing notice_id or building_id" },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    const { data: notice, error: noticeError } = await supabase
      .from("notices")
      .select(
        `
        id,
        title,
        content,
        priority,
        category,
        created_by,
        building_id,
        author:profiles!created_by(first_name, last_name)
      `,
      )
      .eq("id", notice_id)
      .single()

    if (noticeError || !notice) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 })
    }

    const { data: building, error: buildingError } = await supabase
      .from("buildings")
      .select("full_address, manager_id")
      .eq("id", building_id)
      .single()

    if (buildingError || !building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 })
    }

    const { data: residents, error: residentsError } = await supabase
      .from("building_residents")
      .select(
        `
        profile_id,
        profiles!inner(id, email, first_name, last_name)
      `,
      )
      .eq("building_id", building_id)
      .eq("is_approved", true)

    if (residentsError) {
      return NextResponse.json(
        { error: "Failed to fetch residents" },
        { status: 500 },
      )
    }

    const { data: managerProfile } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("id", building.manager_id)
      .single()

    const allRecipients = [
      ...(residents || []),
      ...(managerProfile && managerProfile.email
        ? [{ profile_id: managerProfile.id, profiles: managerProfile }]
        : []),
    ]

    const userIds = allRecipients?.map((r: any) => r.profiles.id) || []
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("user_id, email_notices")
      .eq("building_id", building_id)
      .in("user_id", userIds)

    const preferencesMap = new Map(
      preferences?.map(p => [p.user_id, p.email_notices]) || [],
    )

    const recipientsToEmail = allRecipients?.filter((r: any) => {
      const userId = r.profiles.id
      const wantsEmail = preferencesMap.get(userId) ?? true
      return wantsEmail && r.profiles.email
    })

    if (!recipientsToEmail || recipientsToEmail.length === 0) {
      return NextResponse.json(
        { message: "No recipients to email", sent: 0 },
        { status: 200 },
      )
    }

    const author = Array.isArray(notice.author) ? notice.author[0] : notice.author
    const authorName = author
      ? `${author.first_name} ${author.last_name}`
      : "Building Manager"

    const priorityEmoji =
      notice.priority === "urgent"
        ? "🔴"
        : notice.priority === "low"
          ? "🔵"
          : "⚪"

    if (MOCK_EMAIL) {
      return NextResponse.json({
        message: `[MOCK] Would send ${recipientsToEmail.length} emails`,
        recipients: recipientsToEmail.length,
        sent: recipientsToEmail.length,
        mock: true,
      })
    }

    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .notice-title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
            .notice-content { background-color: white; padding: 15px; border-radius: 6px; margin-top: 15px; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
            .priority { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .priority-urgent { background-color: #fecaca; color: #991b1b; }
            .priority-normal { background-color: #e5e7eb; color: #374151; }
            .priority-low { background-color: #dbeafe; color: #1e40af; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📢 New Notice Posted</h1>
              <p>${escapeHtml(building.full_address)}</p>
            </div>
            <div class="content">
              <div class="notice-title">
                ${priorityEmoji} ${escapeHtml(notice.title)}
                <span class="priority priority-${escapeHtml(notice.priority)}">${escapeHtml(notice.priority.toUpperCase())}</span>
              </div>
              <p><strong>Posted by:</strong> ${escapeHtml(authorName)}</p>
              <p><strong>Category:</strong> ${escapeHtml(notice.category || "general")}</p>
              <div class="notice-content">
                <p>${escapeHtml(notice.content).replace(/\n/g, "<br>")}</p>
              </div>
            </div>
            <div class="footer">
              <p>This notice was posted to your building's notice board.</p>
              <p>To manage your notification preferences, visit your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const emailPromises = recipientsToEmail.map(async (recipient: any) => {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "Building Notices <onboarding@resend.dev>",
          to: [recipient.profiles.email],
          subject: `New Notice: ${notice.title}`,
          html: emailHtml,
        })
        return true
      } catch {
        return false
      }
    })

    const results = await Promise.allSettled(emailPromises)
    const successCount = results.filter(
      r => r.status === "fulfilled" && r.value,
    ).length

    return NextResponse.json({
      message: `Sent ${successCount} of ${recipientsToEmail.length} emails`,
      recipients: recipientsToEmail.length,
      sent: successCount,
    })
  } catch (error: any) {
    console.error("Error sending notice emails:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    )
  }
}
