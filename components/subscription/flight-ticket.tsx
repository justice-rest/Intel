import React, { useRef, useState } from "react"
import styles from "./flight-ticket.module.css"
import { ArrowRight } from "@phosphor-icons/react"

interface FlightTicketProps {
  plan: string // "growth" | "pro" | "scale"
  credits: number | "unlimited"
  userName?: string
}

export function FlightTicket({ plan, credits, userName = "Anonasaurus, Rex" }: FlightTicketProps) {
  const displayCredits = credits === "unlimited" ? "∞" : credits
  const displayName = userName || "Anonasaurus, Rex"
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showArrow, setShowArrow] = useState(true)

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      // Hide arrow when fully scrolled to the right
      setShowArrow(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  const scrollToRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className={styles.ticketContainer}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={styles.ticketBox}
      >
      <ul className={styles.left}>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
      </ul>

      <ul className={styles.right}>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
      </ul>

      <div className={styles.ticket}>
        <span className={styles.airline}>Rōmy</span>
        <span className={`${styles.airline} ${styles.airlineslip}`}>Rōmy</span>
        <span className={styles.boarding}>Credit Pass</span>
        <div className={styles.content}>
          <span className={styles.jfk}>WE</span>
          <span className={styles.plane}>
            <svg
              clipRule="evenodd"
              fillRule="evenodd"
              height="60"
              width="60"
              imageRendering="optimizeQuality"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
              viewBox="0 0 500 500"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g stroke="#222">
                <line
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth="30"
                  x1="300"
                  x2="55"
                  y1="390"
                  y2="390"
                />
                <path
                  d="M98 325c-9 10 10 16 25 6l311-156c24-17 35-25 42-50 2-15-46-11-78-7-15 1-34 10-42 16l-56 35 1-1-169-31c-14-3-24-5-37-1-10 5-18 10-27 18l122 72c4 3 5 7 1 9l-44 27-75-15c-10-2-18-4-28 0-8 4-14 9-20 15l74 63z"
                  fill="#222"
                  strokeLinejoin="round"
                  strokeWidth="10"
                />
              </g>
            </svg>
          </span>
          <span className={styles.sfo}>YOU</span>

          <span className={`${styles.jfk} ${styles.jfkslip}`}>WE</span>
          <span className={`${styles.plane} ${styles.planeslip}`}>
            <svg
              clipRule="evenodd"
              fillRule="evenodd"
              height="50"
              width="50"
              imageRendering="optimizeQuality"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
              viewBox="0 0 500 500"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g stroke="#222">
                <line
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth="30"
                  x1="300"
                  x2="55"
                  y1="390"
                  y2="390"
                />
                <path
                  d="M98 325c-9 10 10 16 25 6l311-156c24-17 35-25 42-50 2-15-46-11-78-7-15 1-34 10-42 16l-56 35 1-1-169-31c-14-3-24-5-37-1-10 5-18 10-27 18l122 72c4 3 5 7 1 9l-44 27-75-15c-10-2-18-4-28 0-8 4-14 9-20 15l74 63z"
                  fill="#222"
                  strokeLinejoin="round"
                  strokeWidth="10"
                />
              </g>
            </svg>
          </span>
          <span className={`${styles.sfo} ${styles.sfoslip}`}>YOU</span>
          <div className={styles.subContent}>
            <span className={styles.watermark}>Get Rōmy</span>
            <span className={styles.name}>
              PASSENGER NAME
              <br />
              <span>{displayName}</span>
            </span>
            <span className={styles.flight}>
              FLIGHT N°
              <br />
              <span>X3-65C3</span>
            </span>
            <span className={styles.gate}>
              CREDITS
              <br />
              <span>{displayCredits}</span>
            </span>
            <span className={styles.seat}>
              PLAN
              <br />
              <span>{plan}</span>
            </span>
            <span className={styles.boardingtime}>
              BOARDING TIME
              <br />
              <span>8:25PM ON AUGUST 2013</span>
            </span>

            <span className={`${styles.flight} ${styles.flightslip}`}>
              FLIGHT N°
              <br />
              <span>X3-65C3</span>
            </span>
            <span className={`${styles.seat} ${styles.seatslip}`}>
              PLAN
              <br />
              <span>{plan}</span>
            </span>
            <span className={`${styles.name} ${styles.nameslip}`}>
              PASSENGER NAME
              <br />
              <span>{displayName}</span>
            </span>
          </div>
        </div>
        <div className={styles.barcode}></div>
        <div className={`${styles.barcode} ${styles.slip}`}></div>
      </div>
      </div>

      {/* Mobile-only arrow button */}
      {showArrow && (
        <button
          onClick={scrollToRight}
          className={styles.scrollArrow}
          aria-label="Show full ticket"
        >
          <div className={styles.arrowIcon}>
            <ArrowRight className="h-4 w-4" weight="bold" />
          </div>
        </button>
      )}
    </div>
  )
}
