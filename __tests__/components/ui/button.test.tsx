import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button } from "@/components/ui/button"

describe("Button component", () => {
  it("renders with default variant and size", () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole("button", { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it("renders children correctly", () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByText("Test Button")).toBeInTheDocument()
  })

  it("handles click events", () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    fireEvent.click(screen.getByRole("button"))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("can be disabled", () => {
    const handleClick = vi.fn()
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    )
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it("applies custom className", () => {
    render(<Button className="custom-class">Button</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("custom-class")
  })

  it("renders with destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("bg-destructive")
  })

  it("renders with outline variant", () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("border")
  })

  it("renders with secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("bg-secondary")
  })

  it("renders with ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("hover:bg-accent")
  })

  it("renders with link variant", () => {
    render(<Button variant="link">Link</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("text-primary")
  })

  it("renders with small size", () => {
    render(<Button size="sm">Small</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("h-8")
  })

  it("renders with large size", () => {
    render(<Button size="lg">Large</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("h-10")
  })

  it("renders with icon size", () => {
    render(<Button size="icon">🔍</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("h-9", "w-9")
  })

  it("supports type attribute", () => {
    render(<Button type="submit">Submit</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("type", "submit")
  })

  it("forwards ref correctly", () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement>
    render(<Button ref={ref}>Ref Button</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
