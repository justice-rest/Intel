/**
 * Circuit Breaker Service
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * and protect against repeatedly calling failing services.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * Features:
 * - Automatic failure detection
 * - Configurable thresholds and timeouts
 * - Graceful recovery with half-open state
 * - Per-source circuit breakers
 */

/**
 * Circuit breaker states
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 3) */
  failureThreshold: number
  /** Time to wait before trying again (ms, default: 5 minutes) */
  resetTimeout: number
  /** Number of successful calls needed to close circuit (default: 1) */
  successThreshold: number
  /** Time window for counting failures (ms, default: 1 minute) */
  failureWindow: number
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeout: 5 * 60 * 1000, // 5 minutes
  successThreshold: 1,
  failureWindow: 60 * 1000, // 1 minute
}

/**
 * Failure record
 */
interface FailureRecord {
  timestamp: number
  error: string
}

/**
 * Circuit state data
 */
interface CircuitData {
  state: CircuitState
  failures: FailureRecord[]
  successes: number
  lastFailure: number | null
  lastStateChange: number
  config: CircuitBreakerConfig
}

/**
 * Circuit breaker result
 */
export interface CircuitBreakerResult<T> {
  success: boolean
  data?: T
  error?: string
  circuitState: CircuitState
  executionTime: number
}

/**
 * Circuit Breaker
 *
 * Protects against repeatedly calling failing services by "tripping"
 * after a threshold of failures, then automatically recovering.
 */
export class CircuitBreaker {
  private circuits: Map<string, CircuitData> = new Map()
  private defaultConfig: CircuitBreakerConfig

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.defaultConfig = {
      ...DEFAULT_CIRCUIT_CONFIG,
      ...config,
    }
  }

  /**
   * Get or create circuit data for a source
   */
  private getCircuit(source: string, config?: Partial<CircuitBreakerConfig>): CircuitData {
    let circuit = this.circuits.get(source)

    if (!circuit) {
      circuit = {
        state: "CLOSED",
        failures: [],
        successes: 0,
        lastFailure: null,
        lastStateChange: Date.now(),
        config: {
          ...this.defaultConfig,
          ...config,
        },
      }
      this.circuits.set(source, circuit)
    }

    return circuit
  }

  /**
   * Clean up old failures outside the window
   */
  private cleanupFailures(circuit: CircuitData): void {
    const cutoff = Date.now() - circuit.config.failureWindow
    circuit.failures = circuit.failures.filter(f => f.timestamp > cutoff)
  }

  /**
   * Check if circuit should be open
   */
  private shouldBeOpen(circuit: CircuitData): boolean {
    this.cleanupFailures(circuit)
    return circuit.failures.length >= circuit.config.failureThreshold
  }

  /**
   * Check if circuit can transition to half-open
   */
  private canTransitionToHalfOpen(circuit: CircuitData): boolean {
    if (circuit.state !== "OPEN") return false
    if (circuit.lastFailure === null) return true

    const timeSinceLastFailure = Date.now() - circuit.lastFailure
    return timeSinceLastFailure >= circuit.config.resetTimeout
  }

  /**
   * Update circuit state based on current conditions
   */
  private updateState(circuit: CircuitData): void {
    const now = Date.now()

    switch (circuit.state) {
      case "CLOSED":
        if (this.shouldBeOpen(circuit)) {
          circuit.state = "OPEN"
          circuit.lastStateChange = now
          console.log(`[CircuitBreaker] Circuit OPENED`)
        }
        break

      case "OPEN":
        if (this.canTransitionToHalfOpen(circuit)) {
          circuit.state = "HALF_OPEN"
          circuit.lastStateChange = now
          circuit.successes = 0
          console.log(`[CircuitBreaker] Circuit HALF_OPEN`)
        }
        break

      case "HALF_OPEN":
        // State transitions happen in recordSuccess/recordFailure
        break
    }
  }

  /**
   * Check if a request is allowed for a source
   */
  isAllowed(source: string): boolean {
    const circuit = this.getCircuit(source)
    this.updateState(circuit)

    switch (circuit.state) {
      case "CLOSED":
        return true
      case "HALF_OPEN":
        return true // Allow limited requests to test recovery
      case "OPEN":
        return false
    }
  }

  /**
   * Record a successful call
   */
  recordSuccess(source: string): void {
    const circuit = this.getCircuit(source)

    if (circuit.state === "HALF_OPEN") {
      circuit.successes++
      if (circuit.successes >= circuit.config.successThreshold) {
        circuit.state = "CLOSED"
        circuit.failures = []
        circuit.lastStateChange = Date.now()
        console.log(`[CircuitBreaker] Circuit CLOSED (recovered)`)
      }
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(source: string, error: string = "Unknown error"): void {
    const circuit = this.getCircuit(source)
    const now = Date.now()

    circuit.failures.push({ timestamp: now, error })
    circuit.lastFailure = now

    if (circuit.state === "HALF_OPEN") {
      // Any failure in half-open state reopens circuit
      circuit.state = "OPEN"
      circuit.lastStateChange = now
      console.log(`[CircuitBreaker] Circuit REOPENED (failure in half-open)`)
    } else {
      this.updateState(circuit)
    }
  }

  /**
   * Get current state of a circuit
   */
  getState(source: string): CircuitState {
    const circuit = this.getCircuit(source)
    this.updateState(circuit)
    return circuit.state
  }

  /**
   * Get detailed info about a circuit
   */
  getInfo(source: string): {
    state: CircuitState
    failureCount: number
    timeSinceLastFailure: number | null
    timeUntilReset: number | null
  } {
    const circuit = this.getCircuit(source)
    this.updateState(circuit)
    this.cleanupFailures(circuit)

    let timeUntilReset: number | null = null
    if (circuit.state === "OPEN" && circuit.lastFailure !== null) {
      const elapsed = Date.now() - circuit.lastFailure
      timeUntilReset = Math.max(0, circuit.config.resetTimeout - elapsed)
    }

    return {
      state: circuit.state,
      failureCount: circuit.failures.length,
      timeSinceLastFailure: circuit.lastFailure ? Date.now() - circuit.lastFailure : null,
      timeUntilReset,
    }
  }

  /**
   * Force reset a circuit to closed state
   */
  reset(source: string): void {
    const circuit = this.circuits.get(source)
    if (circuit) {
      circuit.state = "CLOSED"
      circuit.failures = []
      circuit.successes = 0
      circuit.lastFailure = null
      circuit.lastStateChange = Date.now()
      console.log(`[CircuitBreaker] Circuit RESET for ${source}`)
    }
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const source of this.circuits.keys()) {
      this.reset(source)
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    source: string,
    fn: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<CircuitBreakerResult<T>> {
    const circuit = this.getCircuit(source, config)
    this.updateState(circuit)
    const startTime = Date.now()

    // Check if circuit is open
    if (circuit.state === "OPEN") {
      return {
        success: false,
        error: `Circuit is OPEN for ${source}. Will retry after ${circuit.config.resetTimeout / 1000}s`,
        circuitState: circuit.state,
        executionTime: Date.now() - startTime,
      }
    }

    try {
      const data = await fn()
      this.recordSuccess(source)

      return {
        success: true,
        data,
        circuitState: this.getState(source),
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.recordFailure(source, errorMessage)

      return {
        success: false,
        error: errorMessage,
        circuitState: this.getState(source),
        executionTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Get statistics for all circuits
   */
  getStats(): Record<string, {
    state: CircuitState
    failureCount: number
    recentErrors: string[]
  }> {
    const stats: Record<string, {
      state: CircuitState
      failureCount: number
      recentErrors: string[]
    }> = {}

    for (const [source, circuit] of this.circuits) {
      this.updateState(circuit)
      this.cleanupFailures(circuit)

      stats[source] = {
        state: circuit.state,
        failureCount: circuit.failures.length,
        recentErrors: circuit.failures.slice(-3).map(f => f.error),
      }
    }

    return stats
  }
}

/**
 * Global circuit breaker singleton
 */
let globalCircuitBreaker: CircuitBreaker | null = null

/**
 * Get the global circuit breaker instance
 */
export function getCircuitBreaker(): CircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new CircuitBreaker()
  }
  return globalCircuitBreaker
}

/**
 * Higher-order function for circuit breaker protection
 */
export function withCircuitBreaker<T extends unknown[], R>(
  source: string,
  fn: (...args: T) => Promise<R>,
  breaker?: CircuitBreaker
): (...args: T) => Promise<CircuitBreakerResult<R>> {
  const circuitBreaker = breaker || getCircuitBreaker()

  return async (...args: T): Promise<CircuitBreakerResult<R>> => {
    return circuitBreaker.execute(source, () => fn(...args))
  }
}
