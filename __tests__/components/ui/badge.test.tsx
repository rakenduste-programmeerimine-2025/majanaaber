import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "@/components/ui/badge"

describe("Badge component", () => {
  it("renders with default variant", () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText("Default")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-primary")
  })

  it("renders children correctly", () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText("Test Badge")).toBeInTheDocument()
  })

  it("renders with secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    const badge = screen.getByText("Secondary")
    expect(badge).toHaveClass("bg-secondary")
  })

  it("renders with destructive variant", () => {
    render(<Badge variant="destructive">Destructive</Badge>)
    const badge = screen.getByText("Destructive")
    expect(badge).toHaveClass("bg-destructive")
  })

  it("renders with outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText("Outline")
    expect(badge).toHaveClass("text-foreground")
  })

  it("applies custom className", () => {
    render(<Badge className="custom-badge">Custom</Badge>)
    const badge = screen.getByText("Custom")
    expect(badge).toHaveClass("custom-badge")
  })

  it("merges custom className with variant classes", () => {
    render(
      <Badge variant="destructive" className="ml-2">
        Merged
      </Badge>
    )
    const badge = screen.getByText("Merged")
    expect(badge).toHaveClass("bg-destructive", "ml-2")
  })

  it("renders with additional HTML attributes", () => {
    render(<Badge data-testid="test-badge">Test</Badge>)
    expect(screen.getByTestId("test-badge")).toBeInTheDocument()
  })

  it("has correct base styling", () => {
    render(<Badge>Styled</Badge>)
    const badge = screen.getByText("Styled")
    expect(badge).toHaveClass("inline-flex", "items-center", "rounded-md")
  })

  it("renders complex children", () => {
    render(
      <Badge>
        <span>Icon</span>
        <span>Text</span>
      </Badge>
    )
    expect(screen.getByText("Icon")).toBeInTheDocument()
    expect(screen.getByText("Text")).toBeInTheDocument()
  })
})
