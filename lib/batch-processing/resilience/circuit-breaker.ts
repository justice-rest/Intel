/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascade failures by detecting failing services and stopping
 * requests to them temporarily. This protects both the batch processing
 * system and the external APIs from being overwhelmed.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 */

// ============================================================================
// TYPES
// ============================================================================

export type CircuitBreakerState = "closed" | "open" | "half_open"

export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures before opening the circuit
   * @default 5
   */
  failureThreshold: number

  /**
   * Number of consecutive successes needed to close the circuit from half-open
   * @default 2
   */
  successThreshold: number

  /**
   * Time in milliseconds to stay open before testing with half-open
   * @default 60000 (1 minute)
   */
  timeout: number

  /**
   * Optional name for logging purposes
   */
  name?: string

  /**
   * Callback when circuit state changes
   */
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState
  failures: number
  successes: number
  lastFailure: Date | null
  lastSuccess: Date | null
  openedAt: Date | null
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
}

export interface CircuitBreakerError extends Error {
  circuitBreakerOpen: true
  serviceName: string
  retryAfter: number
}

// ============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// ============================================================================

export class CircuitBreaker {
  private state: CircuitBreakerState = "closed"
  private failures: number = 0
  private successes: number = 0
  private lastFailure: Date | null = null
  private lastSuccess: Date | null = null
  private openedAt: Date | null = null

  // Lifetime stats
  private totalRequests: number = 0
  private totalFailures: number = 0
  private totalSuccesses: number = 0

  private readonly config: Required<CircuitBreakerConfig>

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000,
      name: config.name ?? "unknown",
      onStateChange: config.onStateChange ?? (() => {}),
    }
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @throws CircuitBreakerError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++

    // Check if we should attempt the request
    if (!this.canAttempt()) {
      throw this.createOpenError()
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  /**
   * Check if a request can be attempted
   */
  canAttempt(): boolean {
    if (this.state === "closed") {
      return true
    }

    if (this.state === "open") {
      // Check if timeout has passed
      if (this.openedAt && Date.now() - this.openedAt.getTime() >= this.config.timeout) {
        this.transitionTo("half_open")
        return true
      }
      return false
    }

    // half_open - allow requests to test recovery
    return true
  }

  /**
   * Check if the circuit is currently open (blocking requests)
   */
  isOpen(): boolean {
    // If in open state, check if we should transition to half-open
    if (this.state === "open" && this.openedAt) {
      if (Date.now() - this.openedAt.getTime() >= this.config.timeout) {
        this.transitionTo("half_open")
        return false
      }
      return true
    }
    return false
  }

  /**
   * Check if the circuit is closed (normal operation)
   */
  isClosed(): boolean {
    return this.state === "closed"
  }

  /**
   * Check if the circuit is half-open (testing recovery)
   */
  isHalfOpen(): boolean {
    return this.state === "half_open"
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.totalSuccesses++
    this.lastSuccess = new Date()
    this.successes++
    this.failures = 0 // Reset consecutive failures

    if (this.state === "half_open") {
      // Need consecutive successes to close
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo("closed")
      }
    }

    console.log(
      `[CircuitBreaker:${this.config.name}] Success recorded. ` +
        `State: ${this.state}, Consecutive successes: ${this.successes}`
    )
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.totalFailures++
    this.lastFailure = new Date()
    this.failures++
    this.successes = 0 // Reset consecutive successes

    if (this.state === "half_open") {
      // Single failure in half-open returns to open
      this.transitionTo("open")
    } else if (this.state === "closed") {
      // Check if we've hit the failure threshold
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo("open")
      }
    }

    console.log(
      `[CircuitBreaker:${this.config.name}] Failure recorded. ` +
        `State: ${this.state}, Consecutive failures: ${this.failures}`
    )
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    }
  }

  /**
   * Get the current state
   */
  getState(): CircuitBreakerState {
    // Check for automatic transition from open to half-open
    if (this.state === "open" && this.openedAt) {
      if (Date.now() - this.openedAt.getTime() >= this.config.timeout) {
        this.transitionTo("half_open")
      }
    }
    return this.state
  }

  /**
   * Get time remaining until circuit closes (for open state)
   * Returns 0 if circuit is not open
   */
  getTimeUntilClose(): number {
    if (this.state !== "open" || !this.openedAt) {
      return 0
    }
    const elapsed = Date.now() - this.openedAt.getTime()
    return Math.max(0, this.config.timeout - elapsed)
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.transitionTo("closed")
    this.failures = 0
    this.successes = 0
    console.log(`[CircuitBreaker:${this.config.name}] Manually reset`)
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  forceOpen(): void {
    this.transitionTo("open")
    console.log(`[CircuitBreaker:${this.config.name}] Manually forced open`)
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) return

    const oldState = this.state
    this.state = newState

    if (newState === "open") {
      this.openedAt = new Date()
    } else if (newState === "closed") {
      this.openedAt = null
      this.failures = 0
      this.successes = 0
    } else if (newState === "half_open") {
      this.successes = 0
    }

    console.log(
      `[CircuitBreaker:${this.config.name}] State transition: ${oldState} → ${newState}`
    )

    this.config.onStateChange(oldState, newState)
  }

  private createOpenError(): CircuitBreakerError {
    const error = new Error(
      `Circuit breaker is open for service: ${this.config.name}. ` +
        `Retry after ${Math.ceil(this.getTimeUntilClose() / 1000)} seconds.`
    ) as CircuitBreakerError

    error.circuitBreakerOpen = true
    error.serviceName = this.config.name
    error.retryAfter = this.getTimeUntilClose()

    return error
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

/**
 * Global registry for circuit breakers
 * Ensures single instance per service across the application
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map()

  /**
   * Get or create a circuit breaker for a service
   */
  getOrCreate(name: string, config: Omit<CircuitBreakerConfig, "name">): CircuitBreaker {
    let breaker = this.breakers.get(name)

    if (!breaker) {
      breaker = new CircuitBreaker({ ...config, name })
      this.breakers.set(name, breaker)
      console.log(`[CircuitBreakerRegistry] Created breaker for: ${name}`)
    }

    return breaker
  }

  /**
   * Get an existing circuit breaker
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name)
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {}
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats()
    }
    return stats
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
    console.log("[CircuitBreakerRegistry] All breakers reset")
  }

  /**
   * Check if any circuit breaker is open
   */
  hasOpenCircuits(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.isOpen()) return true
    }
    return false
  }

  /**
   * Get names of all open circuits
   */
  getOpenCircuits(): string[] {
    const open: string[] = []
    for (const [name, breaker] of this.breakers) {
      if (breaker.isOpen()) open.push(name)
    }
    return open
  }
}

// Singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

// ============================================================================
// PRE-CONFIGURED CIRCUIT BREAKERS
// ============================================================================

/**
 * Default configurations for different service types
 */
export const CIRCUIT_BREAKER_CONFIGS = {
  /**
   * For primary LLM services (Perplexity Sonar Pro)
   * More lenient - these are critical to the pipeline
   */
  primaryLLM: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  },

  /**
   * For secondary/optional LLM services (Grok, etc.)
   * Less lenient - we can skip these if they're failing
   */
  secondaryLLM: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 45000, // 45 seconds
  },

  /**
   * For search APIs (LinkUp)
   * Quick failure detection, quick recovery
   */
  searchAPI: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
  },

  /**
   * For verification APIs (SEC, FEC, ProPublica)
   * Very tolerant - these are nice-to-have
   */
  verificationAPI: {
    failureThreshold: 5,
    successThreshold: 1,
    timeout: 120000, // 2 minutes
  },
} as const

/**
 * Get pre-configured circuit breakers for batch processing services
 */
export function getBatchProcessingCircuitBreakers() {
  return {
    perplexity: circuitBreakerRegistry.getOrCreate("perplexity", CIRCUIT_BREAKER_CONFIGS.primaryLLM),
    linkup: circuitBreakerRegistry.getOrCreate("linkup", CIRCUIT_BREAKER_CONFIGS.searchAPI),
    parallel: circuitBreakerRegistry.getOrCreate("parallel-batch", CIRCUIT_BREAKER_CONFIGS.searchAPI),
    grok: circuitBreakerRegistry.getOrCreate("grok", CIRCUIT_BREAKER_CONFIGS.secondaryLLM),
    sec: circuitBreakerRegistry.getOrCreate("sec_edgar", CIRCUIT_BREAKER_CONFIGS.verificationAPI),
    fec: circuitBreakerRegistry.getOrCreate("fec", CIRCUIT_BREAKER_CONFIGS.verificationAPI),
    propublica: circuitBreakerRegistry.getOrCreate("propublica", CIRCUIT_BREAKER_CONFIGS.verificationAPI),
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an error indicates the circuit breaker is open
 */
export function isCircuitBreakerError(error: unknown): error is CircuitBreakerError {
  return (
    error instanceof Error &&
    "circuitBreakerOpen" in error &&
    (error as CircuitBreakerError).circuitBreakerOpen === true
  )
}

/**
 * Execute with circuit breaker, returning null instead of throwing on open circuit
 */
export async function executeWithFallback<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  fallback: T
): Promise<{ result: T; skipped: boolean }> {
  if (!breaker.canAttempt()) {
    console.log(`[CircuitBreaker] Skipping due to open circuit, using fallback`)
    return { result: fallback, skipped: true }
  }

  try {
    const result = await breaker.execute(fn)
    return { result, skipped: false }
  } catch (error) {
    if (isCircuitBreakerError(error)) {
      return { result: fallback, skipped: true }
    }
    throw error
  }
}
