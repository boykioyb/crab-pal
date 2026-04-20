import { CrabPalBrandMark } from "@/components/icons/CrabPalBrandMark"
import { StepFormLayout, ContinueButton } from "./primitives"

interface WelcomeStepProps {
  onContinue: () => void
  /** Whether this is an existing user updating settings */
  isExistingUser?: boolean
  /** Whether the app is loading (e.g., checking Git Bash on Windows) */
  isLoading?: boolean
}

/**
 * WelcomeStep - Initial welcome screen for onboarding
 *
 * Shows different messaging for new vs existing users:
 * - New users: Welcome to CrabPal
 * - Existing users: Update your API connection settings
 */
export function WelcomeStep({
  onContinue,
  isExistingUser = false,
  isLoading = false
}: WelcomeStepProps) {
  return (
    <StepFormLayout
      iconElement={<CrabPalBrandMark size="xl" variant="hero" />}
      title={isExistingUser ? 'Refresh Your Setup' : 'Welcome to CrabPal'}
      description={
        isExistingUser
          ? 'Update your connection, switch providers, or tighten the way CrabPal fits your workflow.'
          : 'Set up a friendlier control deck for agent work. Connect your model, organize your sessions, and start with a cleaner workspace from day one.'
      }
      actions={
        <ContinueButton onClick={onContinue} className="w-full" loading={isLoading} loadingText="Checking...">
          {isExistingUser ? 'Continue' : 'Start Setup'}
        </ContinueButton>
      }
    />
  )
}
