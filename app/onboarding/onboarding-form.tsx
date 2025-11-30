"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "motion/react"
import { TextMorph } from "@/components/motion-primitives/text-morph"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowRight, ArrowUpRight, CaretLeft, Check } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { OnboardingFormData } from "@/app/api/onboarding/route"
import Image from "next/image"

const TOTAL_QUESTIONS = 10

const NONPROFIT_SECTORS = [
  "Arts, Culture, and Humanities",
  "Education",
  "Environment and Animals",
  "Health",
  "Human Services",
  "International / Foreign Affairs",
  "Public and Societal Benefit",
  "Religion",
  "Mutual/Membership Benefit",
  "Other",
]

const BUDGET_RANGES = [
  "Under $100K",
  "$100K - $500K",
  "$500K - $1M",
  "$1M - $5M",
  "$5M - $10M",
  "Over $10M",
]

const DONOR_COUNT_RANGES = [
  "Under 100",
  "100 - 500",
  "500 - 1,000",
  "1,000 - 5,000",
  "5,000 - 10,000",
  "Over 10,000",
]

const WEALTH_SCREENING_TOOLS = [
  "WealthEngine",
  "iWave",
  "DonorSearch",
  "Blackbaud",
  "ResearchPoint",
  "Other",
  "None",
]

interface OnboardingFormProps {
  onComplete: (data: OnboardingFormData) => Promise<void>
}

export function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(0) // Start at 0 for splash screen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showContinueButton, setShowContinueButton] = useState(false)
  const [isHoveringLogo, setIsHoveringLogo] = useState(false)
  const [formData, setFormData] = useState<OnboardingFormData>({
    first_name: null,
    nonprofit_name: null,
    nonprofit_location: null,
    nonprofit_sector: null,
    annual_budget: null,
    donor_count: null,
    fundraising_primary: null,
    prior_tools: null,
    purpose: null,
    agent_name: null,
    additional_context: null,
  })

  const progress = currentStep === 0 ? 0 : ((currentStep - 1) / TOTAL_QUESTIONS) * 100

  const updateField = <K extends keyof OnboardingFormData>(
    field: K,
    value: OnboardingFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const goNext = () => {
    if (currentStep < TOTAL_QUESTIONS + 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const goBack = () => {
    if (currentStep > 2) {
      // Can't go back from video page (step 1) to splash (step 0)
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSplashClick = () => {
    // Play startup sound
    const audio = new Audio("/startup.mp3")
    audio.play().catch((error) => console.error("Error playing audio:", error))
    // Move to video page
    setCurrentStep(1)
  }

  // Show continue button after 6 seconds when on video page
  useEffect(() => {
    if (currentStep === 1) {
      setShowContinueButton(false) // Reset button visibility
      const timer = setTimeout(() => {
        setShowContinueButton(true)
      }, 6000) // 6 seconds

      return () => clearTimeout(timer)
    }
  }, [currentStep])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onComplete(formData)
    } catch (error) {
      console.error("Error submitting onboarding:", error)
      setIsSubmitting(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Splash screen
        return true
      case 1: // Video page
        return true
      case 2:
        return formData.first_name && formData.first_name.trim().length > 0
      case 3:
        return (
          formData.nonprofit_name && formData.nonprofit_name.trim().length > 0
        )
      case 4:
        return (
          formData.nonprofit_location &&
          formData.nonprofit_location.trim().length > 0
        )
      case 5:
        return formData.nonprofit_sector !== null
      case 6:
        return formData.annual_budget !== null
      case 7:
        return formData.donor_count !== null
      case 8:
        return formData.fundraising_primary !== null
      case 9:
        return formData.prior_tools !== null && formData.prior_tools.length > 0
      case 10:
        return formData.purpose && formData.purpose.trim().length > 0
      case 11:
        return formData.agent_name && formData.agent_name.trim().length > 0
      default:
        return false
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed()) {
      e.preventDefault()
      if (currentStep === TOTAL_QUESTIONS + 1) {
        handleSubmit()
      } else {
        goNext()
      }
    }
  }

  const toggleTool = (tool: string) => {
    const currentTools = formData.prior_tools || []
    const hasNone = currentTools.includes("None")
    const isTogglingNone = tool === "None"

    if (isTogglingNone) {
      updateField("prior_tools", ["None"])
    } else {
      const newTools = currentTools.includes(tool)
        ? currentTools.filter((t) => t !== tool)
        : [...currentTools.filter((t) => t !== "None"), tool]
      updateField("prior_tools", newTools.length > 0 ? newTools : null)
    }
  }

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Progress Bar */}
      {currentStep > 0 && (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-muted">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Back Button */}
      {currentStep > 2 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={goBack}
          className="fixed left-4 top-4 z-50 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground sm:left-8 sm:top-8"
        >
          <CaretLeft className="size-5" weight="bold" />
          <span className="text-sm font-medium">Back</span>
        </motion.button>
      )}

      {/* Step Counter */}
      {currentStep > 1 && (
        <div className="fixed right-4 top-4 z-50 text-sm font-medium text-muted-foreground sm:right-8 sm:top-8">
          {currentStep - 1} / {TOTAL_QUESTIONS}
        </div>
      )}

      {/* Question Container */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20 pt-16">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* Splash Screen */}
            {currentStep === 0 && (
              <motion.div
                key="splash"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5 }}
                className="flex h-[80vh] cursor-pointer items-center justify-center"
                onClick={handleSplashClick}
              >
                <div
                  className="relative size-28 transition-transform hover:scale-105"
                  onMouseEnter={() => setIsHoveringLogo(true)}
                  onMouseLeave={() => setIsHoveringLogo(false)}
                >
                  <Image
                    src="/PFPs/1.png"
                    alt="Rōmy"
                    width={112}
                    height={112}
                    className={cn(
                      "absolute inset-0 rounded-xl transition-opacity duration-200",
                      isHoveringLogo ? "opacity-0" : "opacity-100"
                    )}
                  />
                  <Image
                    src="/PFPs/2.png"
                    alt="Rōmy"
                    width={112}
                    height={112}
                    className={cn(
                      "absolute inset-0 rounded-xl transition-opacity duration-200",
                      isHoveringLogo ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>
              </motion.div>
            )}

            {/* Video Page */}
            {currentStep === 1 && (
              <motion.div
                key="video"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="relative w-full max-w-3xl" style={{ paddingBottom: "56.25%" }}>
                    <iframe
                      src="https://www.youtube.com/embed/HdWq54vDwAE?autoplay=1&mute=0&rel=0"
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute top-0 left-0 h-full w-full rounded-lg"
                      style={{ border: 0 }}
                    ></iframe>
                  </div>
                  {/* Reserve space for button to prevent layout shift */}
                  <div className="h-12">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: showContinueButton ? 1 : 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                      <Button
                        onClick={goNext}
                        variant="outline"
                        className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                        disabled={!showContinueButton}
                      >
                        Continue{" "}
                        <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                          <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                        </div>
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Question 1: First Name */}
            {currentStep === 2 && (
              <motion.div
                key="q1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <Label className="mb-3 block text-2xl font-medium text-foreground sm:text-3xl">
                    What's your first name?
                  </Label>
                  <Input
                    placeholder="Type your answer here..."
                    value={formData.first_name || ""}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    onKeyDown={handleKeyPress}
                    autoFocus
                    className="h-14 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 text-xl text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <Button
                  onClick={goNext}
                  disabled={!canProceed()}
                  variant="outline"
                  className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                >
                  Continue{" "}
                  <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                </Button>
              </motion.div>
            )}

            {/* Question 2: Nonprofit Name */}
            {currentStep === 3 && (
              <motion.div
                key="q2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <Label className="mb-3 block text-2xl font-medium text-foreground sm:text-3xl">
                    What nonprofit do you work for/with?
                  </Label>
                  <Input
                    placeholder="Organization name..."
                    value={formData.nonprofit_name || ""}
                    onChange={(e) =>
                      updateField("nonprofit_name", e.target.value)
                    }
                    onKeyDown={handleKeyPress}
                    autoFocus
                    className="h-14 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 text-xl text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <Button
                  onClick={goNext}
                  disabled={!canProceed()}
                  variant="outline"
                  className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                >
                  Continue{" "}
                  <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                </Button>
              </motion.div>
            )}

            {/* Question 3: Location */}
            {currentStep === 4 && (
              <motion.div
                key="q3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <Label className="mb-3 block text-2xl font-medium text-foreground sm:text-3xl">
                    Where is it based?
                  </Label>
                  <p className="mb-4 text-sm text-muted-foreground">
                    City/State or Country
                  </p>
                  <Input
                    placeholder="e.g., New York, NY or United Kingdom"
                    value={formData.nonprofit_location || ""}
                    onChange={(e) =>
                      updateField("nonprofit_location", e.target.value)
                    }
                    onKeyDown={handleKeyPress}
                    autoFocus
                    className="h-14 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 text-xl text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <Button
                  onClick={goNext}
                  disabled={!canProceed()}
                  variant="outline"
                  className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                >
                  Continue{" "}
                  <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                </Button>
              </motion.div>
            )}

            {/* Question 4: Sector */}
            {currentStep === 5 && (
              <motion.div
                key="q4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <Label className="mb-6 block text-2xl font-medium text-foreground sm:text-3xl">
                  What sector is it in?
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {NONPROFIT_SECTORS.map((sector) => (
                    <button
                      key={sector}
                      onClick={() => {
                        updateField("nonprofit_sector", sector)
                        setTimeout(goNext, 200)
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-lg border-2 border-border p-4 text-left text-foreground transition-all hover:border-blue-600 hover:bg-blue-600/10",
                        formData.nonprofit_sector === sector &&
                        "border-blue-600 bg-blue-600/10",
                      )}
                    >
                      <span className="font-medium">{sector}</span>
                      {formData.nonprofit_sector === sector && (
                        <Check className="size-5 text-blue-600" weight="bold" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Question 5: Annual Budget */}
            {currentStep === 6 && (
              <motion.div
                key="q5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <Label className="mb-6 block text-2xl font-medium text-foreground sm:text-3xl">
                  Approximately what is the size of your annual budget?
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {BUDGET_RANGES.map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        updateField("annual_budget", range)
                        setTimeout(goNext, 200)
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-lg border-2 border-border p-4 text-left text-foreground transition-all hover:border-blue-600 hover:bg-blue-600/10",
                        formData.annual_budget === range &&
                        "border-blue-600 bg-blue-600/10",
                      )}
                    >
                      <span className="font-medium">{range}</span>
                      {formData.annual_budget === range && (
                        <Check className="size-5 text-blue-600" weight="bold" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Question 6: Donor Count */}
            {currentStep === 7 && (
              <motion.div
                key="q6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <Label className="mb-6 block text-2xl font-medium text-foreground sm:text-3xl">
                  Approximately how many individual donors are in your database?
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DONOR_COUNT_RANGES.map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        updateField("donor_count", range)
                        setTimeout(goNext, 200)
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-lg border-2 border-border p-4 text-left text-foreground transition-all hover:border-blue-600 hover:bg-blue-600/10",
                        formData.donor_count === range &&
                        "border-blue-600 bg-blue-600/10",
                      )}
                    >
                      <span className="font-medium">{range}</span>
                      {formData.donor_count === range && (
                        <Check className="size-5 text-blue-600" weight="bold" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Question 7: Fundraising Primary */}
            {currentStep === 8 && (
              <motion.div
                key="q7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <Label className="mb-3 block text-2xl font-medium text-foreground sm:text-3xl">
                    Is fundraising your primary responsibility?
                  </Label>
                  <p className="mb-6 text-sm text-muted-foreground">
                    If you are a solo staff member, please answer 'Yes'
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      updateField("fundraising_primary", true)
                      setTimeout(goNext, 200)
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-between rounded-lg border-2 border-border p-6 text-left text-foreground transition-all hover:border-blue-600 hover:bg-blue-600/10",
                      formData.fundraising_primary === true &&
                      "border-blue-600 bg-blue-600/10",
                    )}
                  >
                    <span className="text-lg font-medium">Yes</span>
                    {formData.fundraising_primary === true && (
                      <Check className="size-6 text-blue-600" weight="bold" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      updateField("fundraising_primary", false)
                      setTimeout(goNext, 200)
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-between rounded-lg border-2 border-border p-6 text-left text-foreground transition-all hover:border-blue-600 hover:bg-blue-600/10",
                      formData.fundraising_primary === false &&
                      "border-blue-600 bg-blue-600/10",
                    )}
                  >
                    <span className="text-lg font-medium">No</span>
                    {formData.fundraising_primary === false && (
                      <Check className="size-6 text-blue-600" weight="bold" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Question 8: Prior Tools */}
            {currentStep === 9 && (
              <motion.div
                key="q8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <Label className="mb-6 block text-2xl font-medium text-foreground sm:text-3xl">
                  Have you ever worked with donor wealth screening tools before?
                </Label>
                <div className="space-y-3">
                  {WEALTH_SCREENING_TOOLS.map((tool) => (
                    <button
                      key={tool}
                      onClick={() => toggleTool(tool)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border-2 border-border p-4 text-left text-foreground transition-all hover:border-blue-600 hover:bg-blue-600/10",
                        formData.prior_tools?.includes(tool) &&
                        "border-blue-600 bg-blue-600/10",
                      )}
                    >
                      <span className="font-medium">{tool}</span>
                      {formData.prior_tools?.includes(tool) && (
                        <Check className="size-5 text-blue-600" weight="bold" />
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={goNext}
                  disabled={!canProceed()}
                  variant="outline"
                  className="group mt-4 flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                >
                  Continue{" "}
                  <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                </Button>
              </motion.div>
            )}

            {/* Question 9: Purpose */}
            {currentStep === 10 && (
              <motion.div
                key="q9"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <Label className="mb-4 block text-2xl font-medium text-foreground sm:text-3xl">
                    What&apos;s your purpose in trying Rōmy?
                  </Label>
                  <Textarea
                    placeholder="Tell us what you hope to achieve..."
                    value={formData.purpose || ""}
                    onChange={(e) => updateField("purpose", e.target.value)}
                    autoFocus
                    rows={5}
                    className="resize-none border-2 border-border text-lg text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  onClick={goNext}
                  disabled={!canProceed()}
                  variant="outline"
                  className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                >
                  Continue{" "}
                  <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                </Button>
              </motion.div>
            )}

            {/* Question 10: Agent Name */}
            {currentStep === 11 && (
              <motion.div
                key="q10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <Label className="mb-4 block text-2xl font-medium text-foreground sm:text-3xl">
                    Rōmy is named after the Lagotto Romagnolo dog breed, which is
                    specifically designed to hunt for truffles.
                  </Label>
                  <Label className="mb-4 block text-2xl font-medium text-foreground sm:text-3xl">
                    You are launching your own agentic truffle hound that will
                    understand your goals, your nonprofit and your personal
                    workflows. What do you want to name it?
                  </Label>
                  <p className="mb-4 text-sm text-muted-foreground">
                    (you can change the name later)
                  </p>
                  <Input
                    placeholder="Enter a name for your agent..."
                    value={formData.agent_name || ""}
                    onChange={(e) => updateField("agent_name", e.target.value)}
                    onKeyDown={handleKeyPress}
                    autoFocus
                    className="h-14 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 text-xl text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                  variant="outline"
                  className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                >
                  {isSubmitting ? "Submitting..." : "Complete"}{" "}
                  <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hint Text */}
      {currentStep > 1 && (
        <div className="fixed bottom-6 left-0 right-0 text-center text-sm text-muted-foreground">
          Press <kbd className="rounded bg-muted px-1.5 py-0.5">Enter ↵</kbd> to
          continue
        </div>
      )}
    </div>
  )
}
