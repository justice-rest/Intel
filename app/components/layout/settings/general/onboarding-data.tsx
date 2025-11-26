"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Check, X } from "@phosphor-icons/react"
import { toast } from "sonner"

const NONPROFIT_SECTORS = [
  "Education",
  "Animal Welfare",
  "Poverty Alleviation",
  "Healthcare",
  "Environment",
  "Arts & Culture",
  "Human Rights",
  "Disaster Relief",
  "Religious",
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

interface OnboardingData {
  first_name: string | null
  nonprofit_name: string | null
  nonprofit_location: string | null
  nonprofit_sector: string | null
  annual_budget: string | null
  donor_count: string | null
  fundraising_primary: boolean | null
  prior_tools: string[] | null
  purpose: string | null
  agent_name: string | null
  additional_context: string | null
}

const defaultOnboardingData: OnboardingData = {
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
}

export function OnboardingDataSection() {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<OnboardingData>(defaultOnboardingData)

  // Use React Query for caching - data persists across tab switches
  const { data = defaultOnboardingData, isLoading } = useQuery({
    queryKey: ["onboarding-data"],
    queryFn: async () => {
      const response = await fetch("/api/onboarding")
      if (response.ok) {
        const result = await response.json()
        return result || defaultOnboardingData
      }
      return defaultOnboardingData
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  })

  // Update editedData when data changes
  const startEditing = () => {
    setEditedData(data)
    setIsEditing(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (newData: OnboardingData) => {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newData),
      })
      if (!response.ok) throw new Error("Failed to save")
      return newData
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["onboarding-data"], newData)
      setIsEditing(false)
      toast.success("Onboarding data updated successfully")
    },
    onError: () => {
      toast.error("Failed to update onboarding data")
    },
  })

  const handleSave = () => saveMutation.mutate(editedData)
  const handleCancel = () => {
    setEditedData(data)
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-lg font-medium">Your Information</h3>
          <p className="text-muted-foreground text-sm">
            Loading your information...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="mb-2 text-lg font-medium">Your Information</h3>
          <p className="text-muted-foreground text-sm">
            This information helps personalize your experience with Rōmy
          </p>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={startEditing}
            className="gap-2"
          >
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              {isEditing ? (
                <Input
                  id="first_name"
                  value={editedData.first_name || ""}
                  onChange={(e) =>
                    setEditedData({ ...editedData, first_name: e.target.value })
                  }
                  placeholder="Your name"
                />
              ) : (
                <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                  {data.first_name || "—"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nonprofit_name">Nonprofit Name</Label>
              {isEditing ? (
                <Input
                  id="nonprofit_name"
                  value={editedData.nonprofit_name || ""}
                  onChange={(e) =>
                    setEditedData({
                      ...editedData,
                      nonprofit_name: e.target.value,
                    })
                  }
                  placeholder="Organization name"
                />
              ) : (
                <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                  {data.nonprofit_name || "—"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nonprofit_location">Location</Label>
              {isEditing ? (
                <Input
                  id="nonprofit_location"
                  value={editedData.nonprofit_location || ""}
                  onChange={(e) =>
                    setEditedData({
                      ...editedData,
                      nonprofit_location: e.target.value,
                    })
                  }
                  placeholder="City, State or Country"
                />
              ) : (
                <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                  {data.nonprofit_location || "—"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nonprofit_sector">Sector</Label>
              {isEditing ? (
                <Select
                  value={editedData.nonprofit_sector || ""}
                  onValueChange={(value) =>
                    setEditedData({ ...editedData, nonprofit_sector: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {NONPROFIT_SECTORS.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                  {data.nonprofit_sector || "—"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="annual_budget">Annual Budget</Label>
              {isEditing ? (
                <Select
                  value={editedData.annual_budget || ""}
                  onValueChange={(value) =>
                    setEditedData({ ...editedData, annual_budget: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select budget range" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_RANGES.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                  {data.annual_budget || "—"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="donor_count">Number of Donors</Label>
              {isEditing ? (
                <Select
                  value={editedData.donor_count || ""}
                  onValueChange={(value) =>
                    setEditedData({ ...editedData, donor_count: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select donor count range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DONOR_COUNT_RANGES.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                  {data.donor_count || "—"}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fundraising_primary">
              Is fundraising your primary responsibility?
            </Label>
            {isEditing ? (
              <Select
                value={
                  editedData.fundraising_primary === null
                    ? ""
                    : editedData.fundraising_primary.toString()
                }
                onValueChange={(value) =>
                  setEditedData({
                    ...editedData,
                    fundraising_primary: value === "true",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                {data.fundraising_primary === null
                  ? "—"
                  : data.fundraising_primary
                    ? "Yes"
                    : "No"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Your goal with Rōmy</Label>
            {isEditing ? (
              <Textarea
                id="purpose"
                value={editedData.purpose || ""}
                onChange={(e) =>
                  setEditedData({ ...editedData, purpose: e.target.value })
                }
                placeholder="What do you hope to achieve with Rōmy?"
                rows={3}
              />
            ) : (
              <p className="text-foreground min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2">
                {data.purpose || "—"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent_name">Your AI Agent Name</Label>
            {isEditing ? (
              <Input
                id="agent_name"
                value={editedData.agent_name || ""}
                onChange={(e) =>
                  setEditedData({ ...editedData, agent_name: e.target.value })
                }
                placeholder="Name for your truffle hound"
              />
            ) : (
              <p className="text-foreground rounded-md border border-input bg-transparent px-3 py-2">
                {data.agent_name || "—"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional_context">
              Anything else you want to add?
            </Label>
            <p className="text-muted-foreground text-xs">
              Share any additional context that could help Rōmy provide better
              assistance
            </p>
            {isEditing ? (
              <Textarea
                id="additional_context"
                value={editedData.additional_context || ""}
                onChange={(e) =>
                  setEditedData({
                    ...editedData,
                    additional_context: e.target.value,
                  })
                }
                placeholder="E.g., specific challenges, goals, or preferences..."
                rows={4}
              />
            ) : (
              <p className="text-foreground min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2">
                {data.additional_context || "—"}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-600/90"
              >
                <Check className="size-4" />
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                <X className="size-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
