"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkPasswordStrength,
  getStrengthColor,
  getStrengthText,
} from "@/lib/password-strength";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PasswordStrengthInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showRequirements?: boolean;
  required?: boolean;
}

export function PasswordStrengthInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Enter password",
  showRequirements = true,
  required = false,
}: PasswordStrengthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { strength, requirements } = checkPasswordStrength(value);
  const showIndicator = value.length > 0;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {showIndicator && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getStrengthColor(strength)}`}
                style={{ width: `${(requirements.filter((r) => r.met).length / requirements.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium">{getStrengthText(strength)}</span>
          </div>

          {showRequirements && (
            <ul className="text-xs space-y-1">
              {requirements.map((req, index) => (
                <li
                  key={index}
                  className={`flex items-center gap-1 ${req.met ? "text-green-600" : "text-muted-foreground"}`}
                >
                  <span>{req.met ? "✓" : "○"}</span>
                  <span>{req.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
