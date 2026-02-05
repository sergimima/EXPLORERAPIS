import SignInForm from '@/components/auth/SignInForm';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">Explorer SaaS</h1>
          <p className="text-muted-foreground">Análisis blockchain multi-token</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
