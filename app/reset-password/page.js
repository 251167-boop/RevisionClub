import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <ResetPasswordForm token={token} />;
}
