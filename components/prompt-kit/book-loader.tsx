"use client"

const DURATION = "6.8s"

// Generate page keyframe percentages
const getPageKeyframes = (index: number) => {
  const delay = index * 1.86
  const delayAfter = index * 1.74
  return `
    @keyframes page-${index} {
      ${4 + delay}% { transform: rotateZ(0deg) translateX(-18px); }
      ${13 + delayAfter}%, ${54 + delay}% { transform: rotateZ(180deg) translateX(-18px); }
      ${63 + delayAfter}% { transform: rotateZ(0deg) translateX(-18px); }
    }
  `
}

// Generate all keyframes
const keyframes = `
  ${Array.from({ length: 19 }, (_, i) => getPageKeyframes(i)).join('\n')}

  @keyframes book-left {
    4% { transform: rotateZ(90deg); }
    10%, 40% { transform: rotateZ(0deg); }
    46%, 54% { transform: rotateZ(90deg); }
    60%, 90% { transform: rotateZ(0deg); }
    96% { transform: rotateZ(90deg); }
  }

  @keyframes book-right {
    4% { transform: rotateZ(-90deg); }
    10%, 40% { transform: rotateZ(0deg); }
    46%, 54% { transform: rotateZ(-90deg); }
    60%, 90% { transform: rotateZ(0deg); }
    96% { transform: rotateZ(-90deg); }
  }

  @keyframes book-main {
    4% { transform: rotateZ(-90deg); }
    10%, 40% { transform: rotateZ(0deg); transform-origin: 2px 2px; }
    40.01%, 59.99% { transform-origin: 30px 2px; }
    46%, 54% { transform: rotateZ(90deg); }
    60%, 90% { transform: rotateZ(0deg); transform-origin: 2px 2px; }
    96% { transform: rotateZ(-90deg); }
  }
`

export function BookLoader() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <div
        style={{
          width: 32,
          height: 12,
          position: "relative",
          marginTop: 32,
          zoom: 1.5,
        }}
      >
        {/* Inner - book spine */}
        <div
          style={{
            width: 32,
            height: 12,
            position: "relative",
            transformOrigin: "2px 2px",
            transform: "rotateZ(-90deg)",
            animation: `book-main ${DURATION} ease infinite`,
          }}
        >
          {/* Left cover */}
          <div
            style={{
              width: 60,
              height: 4,
              top: 0,
              borderRadius: 2,
              background: "hsl(var(--primary))",
              position: "absolute",
              right: 28,
              transformOrigin: "58px 2px",
              transform: "rotateZ(90deg)",
              animation: `book-left ${DURATION} ease infinite`,
            }}
          >
            <div
              style={{
                content: '""',
                width: 48,
                height: 4,
                borderRadius: 2,
                background: "inherit",
                position: "absolute",
                top: -10,
                left: 6,
              }}
            />
          </div>
          {/* Middle spine */}
          <div
            style={{
              width: 32,
              height: 12,
              border: "4px solid hsl(var(--primary))",
              borderTop: 0,
              borderRadius: "0 0 9px 9px",
              transform: "translateY(2px)",
            }}
          />
          {/* Right cover */}
          <div
            style={{
              width: 60,
              height: 4,
              top: 0,
              borderRadius: 2,
              background: "hsl(var(--primary))",
              position: "absolute",
              left: 28,
              transformOrigin: "2px 2px",
              transform: "rotateZ(-90deg)",
              animation: `book-right ${DURATION} ease infinite`,
            }}
          >
            <div
              style={{
                content: '""',
                width: 48,
                height: 4,
                borderRadius: 2,
                background: "inherit",
                position: "absolute",
                top: -10,
                left: 6,
              }}
            />
          </div>
        </div>
        {/* Pages */}
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            position: "absolute",
            left: "50%",
            top: 0,
          }}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <li
              key={i}
              style={{
                height: 4,
                borderRadius: 2,
                transformOrigin: "100% 2px",
                width: 48,
                right: 0,
                top: -10,
                position: "absolute",
                background: "hsl(var(--primary))",
                transform: "rotateZ(0deg) translateX(-18px)",
                animationDuration: DURATION,
                animationTimingFunction: "ease",
                animationIterationCount: "infinite",
                animationName: `page-${i}`,
              }}
            />
          ))}
        </ul>
      </div>
    </>
  )
}
