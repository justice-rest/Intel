import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr"

export const metadata = {
  title: "Account Deleted | Romy",
  description: "Your account has been permanently deleted.",
}

export default function GoodbyePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
            <CheckCircle className="size-12 text-green-600 dark:text-green-400" weight="fill" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Account Deleted
          </h1>
          <p className="text-muted-foreground">
            Your account and all associated data have been permanently removed from our systems.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p>
            Thank you for using Romy. If you have any questions or feedback,
            please reach out to our support team.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default">
            <Link href="/">
              Return to Home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="mailto:support@getromy.app">
              Contact Support
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Changed your mind? You can always create a new account.
        </p>
      </div>
    </div>
  )
}
