import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();

  // If user is signed in, redirect to dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-4xl font-bold">Welcome to CHD</h1>
      <p className="text-lg text-gray-600">
        Please sign in or sign up to continue.
      </p>
      <p className="text-sm text-gray-500">
        Use the buttons in the header to get started.
      </p>
    </div>
  );
}