import SignInForm from '@/components/auth/SignInForm';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Explorer SaaS</h1>
          <p className="text-gray-600">Análisis blockchain multi-token</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
