/**
 * Verification Module
 *
 * Direct API verification for SEC, FEC, and ProPublica data.
 */

export {
  verifySecInsider,
  searchSecProxy,
  type SecVerificationResult,
} from "./sec-verifier"

export {
  verifyFecContributions,
  hasFecContributions,
  type FecContribution,
  type FecVerificationResult,
} from "./fec-verifier"

export {
  verifyNonprofitAffiliations,
  searchNonprofits,
  getNonprofitDetails,
  checkNonprofitAffiliation,
  type NonprofitAffiliation,
  type PropublicaVerificationResult,
} from "./propublica-verifier"

// Cross-reference verification layer
export {
  crossReferenceVerify,
  quickHallucinationCheck,
  extractVerifiableClaims,
  type VerificationStatus,
  type ClaimVerification,
  type ClaimType,
  type VerificationReport,
} from "./cross-reference"

// Name disambiguation
export {
  calculateDisambiguationScore,
  findBestMatch,
  isCommonName,
  getDisambiguationWarnings,
  type PersonContext,
  type MatchCandidate,
  type DisambiguationScore,
} from "./name-disambiguation"

// Source weighting and confidence scoring
export {
  classifySource,
  extractDomain,
  weightSources,
  calculateSourceBasedConfidence,
  getConfidenceLabel,
  calculateFieldConfidence,
  SOURCE_WEIGHTS,
  type SourceCategory,
  type SourceWeight,
  type WeightedSource,
  type ConfidenceCalculation,
} from "./source-weighting"
