import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { api } from '@/lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Email is required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.forgotPassword({
        email_id: email,
        password_change: newPassword,
        re_typepassword: confirmPassword,
      });
      if (result.success) {
        setMessage("Password updated successfully. You can now log in with your new password.");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(result.error || "Failed to reset password.");
      }
    } catch {
      setError("An error occurred while resetting password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0 px-4 md:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-blue-900 opacity-90" />
        <div className="relative z-20 flex items-center text-lg font-bold">
          <Package2 className="mr-2 h-6 w-6" />
          Madhuram Inventory
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg font-medium leading-relaxed">
              &ldquo;Streamline your inventory, optimize your workflow, and take control of your business assets with precision and ease.&rdquo;
            </p>
            <footer className="text-sm opacity-80">Madhuram Management Team</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8 w-full">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <div className="flex items-center justify-center mb-2 lg:hidden">
               <Package2 className="h-8 w-8 text-primary mr-2" />
               <span className="text-xl font-bold">Madhuram Inventory</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and a new password.
            </p>
          </div>

          <div className="grid gap-6">
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {message && (
                  <Alert>
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    placeholder="name@example.com"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 md:h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reset-password">New Password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    disabled={loading}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-11 md:h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reset-password-confirm">Re-type Password</Label>
                  <Input
                    id="reset-password-confirm"
                    type="password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-11 md:h-10"
                  />
                </div>
                <Button disabled={loading} className="h-11 md:h-10">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 justify-start"
                  onClick={() => navigate('/')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
