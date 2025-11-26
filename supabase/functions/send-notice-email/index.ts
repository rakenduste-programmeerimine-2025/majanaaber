import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

interface NoticeEmailRequest {
  notice_id: string
  building_id: string
}

serve(async (req) => {
  try {
    const { notice_id, building_id }: NoticeEmailRequest = await req.json()

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured")
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
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
      throw new Error("Notice not found")
    }

    const { data: building, error: buildingError } = await supabase
      .from("buildings")
      .select("full_address, manager_id")
      .eq("id", building_id)
      .single()

    if (buildingError || !building) {
      throw new Error("Building not found")
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
      throw new Error("Failed to fetch residents")
    }

    const userIds = residents?.map((r: any) => r.profiles.id) || []

    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("user_id, email_notices")
      .eq("building_id", building_id)
      .in("user_id", userIds)

    const preferencesMap = new Map(
      preferences?.map(p => [p.user_id, p.email_notices]) || [],
    )

    const recipientsToEmail = residents?.filter((r: any) => {
      const userId = r.profiles.id
      const wantsEmail = preferencesMap.get(userId) ?? true
      return wantsEmail && r.profiles.email
    })

    if (!recipientsToEmail || recipientsToEmail.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients to email" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const authorName = notice.author
      ? `${notice.author.first_name} ${notice.author.last_name}`
      : "Building Manager"

    const priorityEmoji =
      notice.priority === "urgent"
        ? "🔴"
        : notice.priority === "low"
          ? "🔵"
          : "⚪"

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
              <p>${building.full_address}</p>
            </div>
            <div class="content">
              <div class="notice-title">
                ${priorityEmoji} ${notice.title}
                <span class="priority priority-${notice.priority}">${notice.priority.toUpperCase()}</span>
              </div>
              <p><strong>Posted by:</strong> ${authorName}</p>
              <p><strong>Category:</strong> ${notice.category}</p>
              <div class="notice-content">
                <p>${notice.content.replace(/\n/g, "<br>")}</p>
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
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Building Notices <notices@majanaaber.app>",
          to: [recipient.profiles.email],
          subject: `New Notice: ${notice.title}`,
          html: emailHtml,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`Failed to send email to ${recipient.profiles.email}:`, error)
      }

      return response.ok
    })

    const results = await Promise.allSettled(emailPromises)
    const successCount = results.filter(r => r.status === "fulfilled" && r.value).length

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} of ${recipientsToEmail.length} emails`,
        recipients: recipientsToEmail.length,
        sent: successCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Error sending notice emails:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
