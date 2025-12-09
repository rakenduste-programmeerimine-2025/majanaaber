import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Input } from "@/components/ui/input"

describe("Input component", () => {
  it("renders correctly", () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument()
  })

  it("accepts and displays value", () => {
    render(<Input defaultValue="test value" />)
    expect(screen.getByDisplayValue("test value")).toBeInTheDocument()
  })

  it("handles onChange events", () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "new value" } })
    expect(handleChange).toHaveBeenCalled()
  })

  it("handles user typing", async () => {
    const user = userEvent.setup()
    render(<Input />)
    const input = screen.getByRole("textbox")
    await user.type(input, "Hello World")
    expect(input).toHaveValue("Hello World")
  })

  it("can be disabled", () => {
    render(<Input disabled />)
    const input = screen.getByRole("textbox")
    expect(input).toBeDisabled()
  })

  it("applies custom className", () => {
    render(<Input className="custom-input" />)
    const input = screen.getByRole("textbox")
    expect(input).toHaveClass("custom-input")
  })

  it("renders with different types", () => {
    const { rerender } = render(<Input type="email" />)
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email")

    rerender(<Input type="password" />)
    // Password inputs don't have textbox role
    const passwordInput = document.querySelector('input[type="password"]')
    expect(passwordInput).toBeInTheDocument()
  })

  it("renders with number type", () => {
    render(<Input type="number" />)
    const input = screen.getByRole("spinbutton")
    expect(input).toHaveAttribute("type", "number")
  })

  it("supports placeholder", () => {
    render(<Input placeholder="Enter your email" />)
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument()
  })

  it("supports required attribute", () => {
    render(<Input required />)
    const input = screen.getByRole("textbox")
    expect(input).toBeRequired()
  })

  it("supports maxLength attribute", () => {
    render(<Input maxLength={10} />)
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("maxLength", "10")
  })

  it("supports aria-label", () => {
    render(<Input aria-label="Search input" />)
    expect(screen.getByLabelText("Search input")).toBeInTheDocument()
  })

  it("forwards ref correctly", () => {
    const ref = { current: null } as React.RefObject<HTMLInputElement>
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it("handles focus and blur events", () => {
    const handleFocus = vi.fn()
    const handleBlur = vi.fn()
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
    const input = screen.getByRole("textbox")

    fireEvent.focus(input)
    expect(handleFocus).toHaveBeenCalledTimes(1)

    fireEvent.blur(input)
    expect(handleBlur).toHaveBeenCalledTimes(1)
  })
})
