/**
 * Fundraising Best Practices Quiz Questions
 *
 * 20 multiple-choice questions designed to educate Growth Plan customers
 * while giving them a fun way to earn extra lookups.
 *
 * Question Levels:
 * - Basic: 5 questions
 * - Intermediate: 9 questions
 * - Advanced: 6 questions
 *
 * Reward Structure:
 * - Basic: 5 bonus messages per correct answer
 * - Intermediate: 7 bonus messages per correct answer
 * - Advanced: 10 bonus messages per correct answer
 * - Maximum: 100 bonus messages per month
 */

export type QuestionLevel = "basic" | "intermediate" | "advanced"

export interface QuizQuestion {
  id: string
  level: QuestionLevel
  category: string
  question: string
  options: {
    label: string
    value: string
  }[]
  correctAnswer: string
  explanation: string
  bonusMessages: number
}

/**
 * All 20 quiz questions organized by level
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ============================================================================
  // BASIC LEVEL (5 questions) - 5 bonus messages each
  // ============================================================================
  {
    id: "Q1",
    level: "basic",
    category: "Donor Acknowledgment",
    question:
      "What is the ideal timeframe for sending a donor acknowledgment letter after receiving a gift?",
    options: [
      { label: "Within 7 days", value: "A" },
      { label: "Within 48 hours", value: "B" },
      { label: "Within 30 days", value: "C" },
      { label: "Within 2 weeks", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "Research shows that donor acknowledgments should be sent within 48 hours of receiving a gift. This prompt response reassures donors that their gift was received and demonstrates appreciation, which is critical for donor retention.",
    bonusMessages: 5,
  },
  {
    id: "Q2",
    level: "basic",
    category: "Donor Retention",
    question:
      "What percentage of first-time donors typically give again to the same nonprofit?",
    options: [
      { label: "45-50%", value: "A" },
      { label: "60-65%", value: "B" },
      { label: "19-24%", value: "C" },
      { label: "35-40%", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "Studies show that only 19-24% of first-time donors give again. This low retention rate emphasizes the critical importance of strong stewardship and thank-you processes for new donors.",
    bonusMessages: 5,
  },
  {
    id: "Q3",
    level: "basic",
    category: "Fundraising Strategy",
    question:
      "According to fundraising research, what percentage of total dollars raised typically comes from what percentage of donors?",
    options: [
      { label: "50% of dollars from 25% of donors", value: "A" },
      { label: "88% of dollars from 12% of donors", value: "B" },
      { label: "75% of dollars from 20% of donors", value: "C" },
      { label: "90% of dollars from 30% of donors", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "The fundraising principle states that 88% of dollars raised comes from just 12% of donors. This demonstrates why major donor cultivation and retention must be a priority for nonprofits.",
    bonusMessages: 5,
  },
  {
    id: "Q4",
    level: "basic",
    category: "Thank You Best Practices",
    question:
      "What is the best practice for acknowledging donors who give multiple times per year?",
    options: [
      {
        label: "Send one comprehensive year-end acknowledgment summarizing all gifts",
        value: "A",
      },
      { label: "Acknowledge each gift individually within 48 hours", value: "B" },
      { label: "Only acknowledge gifts over $250 for tax purposes", value: "C" },
      { label: "Combine acknowledgments quarterly to reduce mailing costs", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "Every gift deserves individual acknowledgment within 48 hours, regardless of frequency. Each donation represents a separate decision to support your mission and should be recognized promptly and individually to build strong donor relationships.",
    bonusMessages: 5,
  },
  {
    id: "Q5",
    level: "basic",
    category: "Prospect Research",
    question:
      "To identify a potential major donor prospect, which TWO factors are most essential?",
    options: [
      { label: "Capacity to give + participation in your events", value: "A" },
      {
        label: "Capacity to give + history of giving OR connection to your cause",
        value: "B",
      },
      { label: "History of giving + attendance at board meetings", value: "C" },
      { label: "Connection to your cause + social media engagement", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "A viable major donor prospect must have capacity (financial ability to make a significant gift) plus at least ONE of: demonstrated philanthropic history OR strong affinity for your mission. Without capacity, they cannot make a major gift regardless of their interest.",
    bonusMessages: 5,
  },

  // ============================================================================
  // INTERMEDIATE LEVEL (9 questions) - 7 bonus messages each
  // ============================================================================
  {
    id: "Q6",
    level: "intermediate",
    category: "Wealth Screening",
    question:
      "Which of the following is NOT one of the three main categories of prospect research indicators?",
    options: [
      { label: "Capacity indicators", value: "A" },
      { label: "Philanthropic indicators", value: "B" },
      { label: "Affinity indicators", value: "C" },
      { label: "Geographic indicators", value: "D" },
    ],
    correctAnswer: "D",
    explanation:
      "The three key prospect research indicators are capacity (wealth), philanthropic (propensity to give), and affinity (connection to your cause). All three must be present to identify a viable major donor prospect.",
    bonusMessages: 7,
  },
  {
    id: "Q7",
    level: "intermediate",
    category: "Wealth Screening",
    question:
      "Individuals who own real estate valued at $2+ million are how many times more likely to give philanthropically than the average person?",
    options: [
      { label: "5 times more likely", value: "A" },
      { label: "10 times more likely", value: "B" },
      { label: "17 times more likely", value: "C" },
      { label: "25 times more likely", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "Research shows that individuals who own real estate valued at $2+ million are 17 times more likely to give philanthropically than the average person, making real estate ownership a powerful wealth indicator.",
    bonusMessages: 7,
  },
  {
    id: "Q8",
    level: "intermediate",
    category: "Donor Cultivation",
    question:
      "According to major gift benchmark studies, how long does it typically take to build a strong enough relationship with a prospective donor to secure a major gift?",
    options: [
      { label: "1-3 months", value: "A" },
      { label: "6 months to 2 years", value: "B" },
      { label: "3-5 years", value: "C" },
      { label: "Less than 6 months", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "Most nonprofits report that it takes between six months and two years to build a strong enough relationship with a prospective donor to secure a major gift. This emphasizes the importance of patient, strategic donor cultivation.",
    bonusMessages: 7,
  },
  {
    id: "Q9",
    level: "intermediate",
    category: "Donor Retention",
    question: "What is the most effective strategy for retaining first-time donors?",
    options: [
      { label: "Send them your monthly newsletter", value: "A" },
      { label: "Wait 6 months before making another ask", value: "B" },
      { label: "Thank them promptly and show impact of their specific gift", value: "C" },
      { label: "Add them to your major donor mailing list", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "The most effective retention strategy is to thank first-time donors immediately and demonstrate the specific impact of their gift. Showing donors how their contribution made a difference creates emotional connection and significantly increases the likelihood they'll give again.",
    bonusMessages: 7,
  },
  {
    id: "Q10",
    level: "intermediate",
    category: "Wealth Screening",
    question:
      "What is the key difference between wealth screening and prospect research?",
    options: [
      { label: "Wealth screening is manual; prospect research is automated", value: "A" },
      {
        label:
          "Wealth screening uses algorithms to identify capacity; prospect research involves human analysis for timing and strategy",
        value: "B",
      },
      { label: "There is no difference; they are the same process", value: "C" },
      {
        label:
          "Wealth screening is only for major donors; prospect research is for all donors",
        value: "D",
      },
    ],
    correctAnswer: "B",
    explanation:
      "Wealth screening is a computerized process that identifies giving capacity using external data. Prospect research involves deeper human analysis to determine relationship-building strategies and optimal timing for asks.",
    bonusMessages: 7,
  },
  {
    id: "Q11",
    level: "intermediate",
    category: "Fundraising Metrics",
    question:
      "Which metric best predicts the long-term value of a donor to your organization?",
    options: [
      { label: "Size of their first gift", value: "A" },
      { label: "Average gift amount", value: "B" },
      { label: "Years of consistent giving × average gift × frequency", value: "C" },
      { label: "Total cumulative giving to date", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "Donor lifetime value (DLV) is calculated by multiplying the donor's lifespan (years of giving) × average donation amount × average donation frequency. This forward-looking metric helps predict future value, not just measure past giving.",
    bonusMessages: 7,
  },
  {
    id: "Q15",
    level: "intermediate",
    category: "Fundraising Metrics",
    question:
      "Which approach helps you understand if investing in donor retention is worthwhile?",
    options: [
      { label: "Average gift size × number of donors", value: "A" },
      { label: "Total revenue ÷ acquisition cost", value: "B" },
      { label: "Value of retained donors vs. cost to acquire new donors", value: "C" },
      { label: "Number of gifts ÷ number of donors", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "Comparing the value of retained donors against new donor acquisition costs reveals retention ROI. Since acquiring new donors costs 5-7 times more than retaining current ones, and retained donors give more over time, this metric demonstrates why retention should be prioritized.",
    bonusMessages: 7,
  },
  {
    id: "Q16",
    level: "intermediate",
    category: "Major Donor Cultivation",
    question:
      "What percentage of major donors ($5K-$50K) were retained between 2023 and Q2 2024 according to the Fundraising Effectiveness Project?",
    options: [
      { label: "28.5%", value: "A" },
      { label: "42.1%", value: "B" },
      { label: "55.3%", value: "C" },
      { label: "68.7%", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "The Fundraising Effectiveness Project reports that 42.1% of major donors ($5K-$50K) were retained between 2023 and Q2 2024, showing that even major donors require consistent stewardship to maintain engagement.",
    bonusMessages: 7,
  },
  {
    id: "Q19",
    level: "intermediate",
    category: "Donor Retention Strategy",
    question:
      "What is the average overall donor retention rate across nonprofits as of recent studies?",
    options: [
      { label: "65-70%", value: "A" },
      { label: "54-58%", value: "B" },
      { label: "43-46%", value: "C" },
      { label: "30-35%", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "The average donor retention rate is approximately 43-46% according to recent research. This means more than half of donors do not give again the following year, highlighting the critical need for retention strategies.",
    bonusMessages: 7,
  },

  // ============================================================================
  // ADVANCED LEVEL (6 questions) - 10 bonus messages each
  // ============================================================================
  {
    id: "Q12",
    level: "advanced",
    category: "Form 990 Research",
    question:
      "When analyzing a foundation's Form 990 to determine if they're a good prospect, which pattern suggests they might support your organization?",
    options: [
      { label: "Large endowment with minimal annual grantmaking", value: "A" },
      {
        label: "History of grants to organizations with similar mission and geography",
        value: "B",
      },
      { label: "High executive compensation relative to grants made", value: "C" },
      {
        label: "Primarily supporting organizations with revenue over $10M",
        value: "D",
      },
    ],
    correctAnswer: "B",
    explanation:
      "Schedule I grant listings showing support for organizations with similar missions and in your geographic area indicate strong alignment. This pattern suggests the foundation's priorities match your cause and they fund organizations like yours.",
    bonusMessages: 10,
  },
  {
    id: "Q13",
    level: "advanced",
    category: "Prospect Research",
    question:
      "Which combination of indicators provides the strongest signal that a prospect is ready for a major gift solicitation?",
    options: [
      { label: "High capacity + previous political giving", value: "A" },
      {
        label:
          "High capacity + philanthropic propensity + strong affinity for your mission",
        value: "B",
      },
      { label: "High capacity + real estate ownership + business affiliations", value: "C" },
      { label: "Philanthropic propensity + event attendance", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "The strongest major gift prospects demonstrate all three indicators: capacity (ability to give), philanthropic propensity (history of giving), and affinity (connection to your specific mission). All three must align.",
    bonusMessages: 10,
  },
  {
    id: "Q14",
    level: "advanced",
    category: "Donor Stewardship",
    question:
      "According to research by Penelope Burk, what impact does a thank-you phone call to a newly acquired donor have on Year 2 revenue?",
    options: [
      { label: "15% increase", value: "A" },
      { label: "25% increase", value: "B" },
      { label: "40% increase", value: "C" },
      { label: "No measurable impact", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "Research shows that a thank-you phone call to newly acquired donors yields 40% more revenue in Year 2. This demonstrates the powerful ROI of personalized donor stewardship.",
    bonusMessages: 10,
  },
  {
    id: "Q17",
    level: "advanced",
    category: "Wealth Screening",
    question:
      "Which government database should you consult to find publicly-traded stock holdings that indicate donor capacity?",
    options: [
      { label: "IRS.gov", value: "A" },
      { label: "FEC.gov", value: "B" },
      { label: "SEC.gov", value: "C" },
      { label: "USA.gov", value: "D" },
    ],
    correctAnswer: "C",
    explanation:
      "SEC.gov (Securities and Exchange Commission) provides public records of stock holdings at publicly-traded companies. This is valuable data for assessing a prospect's wealth capacity.",
    bonusMessages: 10,
  },
  {
    id: "Q18",
    level: "advanced",
    category: "Prospect Research",
    question:
      "When using FEC.gov (Federal Election Commission) data in prospect research, what does significant political giving indicate?",
    options: [
      { label: "Only partisan political alignment", value: "A" },
      {
        label: "Both financial capacity and potential affinity based on political values",
        value: "B",
      },
      { label: "Only that they are registered voters", value: "C" },
      { label: "Their employer information", value: "D" },
    ],
    correctAnswer: "B",
    explanation:
      "FEC.gov political giving data reveals both capacity (ability to make significant contributions) and potential affinity (political leanings may align with certain causes). Someone giving large political gifts has demonstrated philanthropic capacity.",
    bonusMessages: 10,
  },
  {
    id: "Q20",
    level: "advanced",
    category: "Fundraising Best Practices",
    question:
      "In a comprehensive fundraising strategy, what should be the relationship between donor acquisition costs and donor lifetime value?",
    options: [
      {
        label: "Acquisition costs should be minimal compared to DLV to ensure positive ROI",
        value: "A",
      },
      { label: "They should be approximately equal", value: "B" },
      { label: "Acquisition costs can exceed DLV in the short term", value: "C" },
      { label: "There is no relationship between these metrics", value: "D" },
    ],
    correctAnswer: "A",
    explanation:
      "Donor acquisition costs should be significantly lower than donor lifetime value to ensure positive return on investment. If you know a donor's LTV is $1,000, spending $100 to acquire them is worthwhile, but costs should remain proportional.",
    bonusMessages: 10,
  },
]

/**
 * Get questions by level
 */
export function getQuestionsByLevel(level: QuestionLevel): QuizQuestion[] {
  return QUIZ_QUESTIONS.filter((q) => q.level === level)
}

/**
 * Get a single question by ID
 */
export function getQuestionById(id: string): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((q) => q.id === id)
}

/**
 * Get the question of the day based on current date
 *
 * For the first week of a Growth plan user:
 * - Only show basic (easy) questions
 *
 * After the first week:
 * - Mix between all difficulty levels
 *
 * @param userCreatedAt - When the user signed up (ISO string or Date)
 */
export function getQuestionOfTheDay(userCreatedAt?: string | Date | null): QuizQuestion {
  const startDate = new Date("2025-01-01").getTime()
  const today = new Date()
  const todayTime = today.getTime()
  const daysSinceStart = Math.floor((todayTime - startDate) / (1000 * 60 * 60 * 24))

  // Check if user is in their first week
  const isFirstWeek = userCreatedAt
    ? isWithinFirstWeek(userCreatedAt)
    : false

  if (isFirstWeek) {
    // First week: only basic questions
    const basicQuestions = QUIZ_QUESTIONS.filter(q => q.level === "basic")
    const questionIndex = daysSinceStart % basicQuestions.length
    return basicQuestions[questionIndex]
  }

  // After first week: rotate through all questions
  const questionIndex = daysSinceStart % QUIZ_QUESTIONS.length
  return QUIZ_QUESTIONS[questionIndex]
}

/**
 * Check if a user is within their first week of signup
 */
function isWithinFirstWeek(createdAt: string | Date): boolean {
  const signupDate = new Date(createdAt)
  const now = new Date()
  const daysSinceSignup = Math.floor(
    (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  return daysSinceSignup < 7
}

/**
 * Maximum bonus messages per month
 */
export const MAX_MONTHLY_BONUS = 100

/**
 * Quick answer key for reference
 */
export const ANSWER_KEY: Record<string, string> = {
  Q1: "B",
  Q2: "C",
  Q3: "B",
  Q4: "B",
  Q5: "B",
  Q6: "D",
  Q7: "C",
  Q8: "B",
  Q9: "C",
  Q10: "B",
  Q11: "C",
  Q12: "B",
  Q13: "B",
  Q14: "C",
  Q15: "C",
  Q16: "B",
  Q17: "C",
  Q18: "B",
  Q19: "C",
  Q20: "A",
}
