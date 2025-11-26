<main id="app">

    <button>
        <span class="text">きみのてできりさいて</span>
        <span class="shimmer"></span>
    </button>
    
</main>

<!-- 













    social icons
-->
<a class="social-icon codepen" href="https://codepen.io/simeydotme" title="view my codepens">
    Made by Simey
</a>

<a class="social-icon twitter" href="https://twitter.com/simeydotme">
    <svg viewBox="0 0 24 24">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M22 4.01c-1 .49 -1.98 .689 -3 .99c-1.121 -1.265 -2.783 -1.335 -4.38 -.737s-2.643 2.06 -2.62 3.737v1c-3.245 .083 -6.135 -1.395 -8 -4c0 0 -4.182 7.433 4 11c-1.872 1.247 -3.739 2.088 -6 2c3.308 1.803 6.913 2.423 10.034 1.517c3.58 -1.04 6.522 -3.723 7.651 -7.742a13.84 13.84 0 0 0 .497 -3.753c-.002 -.249 1.51 -2.772 1.818 -4.013z"></path>
    </svg>
</a>
<a class="social-icon github" href="https://github.com/simeydotme">
    <svg viewBox="0 0 24 24">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"></path>
    </svg>
</a>

CSS:

:root {
    --glow-hue: 222deg;
    --shadow-hue: 180deg;
    --spring-easing: linear(
    0, 0.002, 0.01 0.9%, 0.038 1.8%, 0.156, 0.312 5.8%, 0.789 11.1%, 1.015 14.2%,
    1.096, 1.157, 1.199, 1.224 20.3%, 1.231, 1.231, 1.226, 1.214 24.6%,
    1.176 26.9%, 1.057 32.6%, 1.007 35.5%, 0.984, 0.968, 0.956, 0.949 42%,
    0.946 44.1%, 0.95 46.5%, 0.998 57.2%, 1.007, 1.011 63.3%, 1.012 68.3%,
    0.998 84%, 1
  );
    --spring-duration: 1.33s;
}
@property --shimmer {
    syntax: "<angle>";
    inherits: false;
    initial-value: 33deg;
}

@keyframes shimmer {
    0% {
        --shimmer: 0deg;
    }
    100% {
        --shimmer: 360deg;
    }
}

@keyframes shine {
    0% {
        opacity: 0;
    }
    15% {
        opacity: 1;
    }
    55% {
        opacity: 1;
    }
    100% {
        opacity: 0;
    }
}
@keyframes text {
    0% {
        background-position: 100% center;
    }    
    100% {
        background-position: -100% center;
    }    
}

button {
    
    --inset: 40px;
    
    color: var(--bg);
    font-weight: 600;
    background-image: linear-gradient(
        315deg,
        #ffc4ec -10%,
        #efdbfd 50%,
        #ffedd6 110%
    );
    padding: .8em 1.4em;
    position: relative;
    isolation: isolate;
    box-shadow: 0 2px 3px 1px hsl(var(--glow-hue) 50% 20% / 50%), inset 0 -10px 20px -10px hsla(var(--shadow-hue),10%,90%,95%);
    border-radius: 0.66em;
    scale: 1;
    transition: all var(--spring-duration) var(--spring-easing);
}

button:hover:not(:active),
button.active {
    transition-duration: calc(var(--spring-duration)*0.5);
    scale: 1.2;
    box-shadow: 0 4px 8px -2px hsl(var(--glow-hue) 50% 20% / 50%), inset 0 0 0 transparent;
}
button:active {
    scale: 1.1;
    transition-duration: calc(var(--spring-duration)*0.5);
}

.shimmer {
    position: absolute;
    inset: calc(var(--inset) * -1);
    border-radius: inherit;
    pointer-events: none;
    mask-image: conic-gradient(
        from var(--shimmer, 0deg),
        transparent 0%,
        transparent 20%,
        black 36%,
        black 45%,
        transparent 50%,
        transparent 70%,
        black 85%,
        black 95%,
        transparent 100%
    );
    mask-size: cover;
    mix-blend-mode: plus-lighter;
    animation: shimmer 1s linear infinite both;
}
button:hover .shimmer::before,
button:hover .shimmer::after,
button.active .shimmer::before,
button.active .shimmer::after {
    opacity: 1;
    animation: shine 1.2s ease-in 1 forwards;
}
.shimmer::before,
.shimmer::after {
    transition: all 0.5s ease;
    opacity: 0;
    content: "";
    border-radius: inherit;
    position: absolute;
    mix-blend-mode: color;
    inset: var(--inset);
    pointer-events: none;
}
.shimmer::before {
    box-shadow: 0 0 calc(var(--inset) * 0.1)  2px hsl(var(--glow-hue) 20% 95%),
        0 0 calc(var(--inset) * 0.18)  4px hsl(var(--glow-hue) 20% 80%),
        0 0 calc(var(--inset) * 0.33)  4px hsl(var(--glow-hue) 50% 70%),
        0 0 calc(var(--inset) * 0.66) 5px hsl(var(--glow-hue) 100% 70%);
    z-index: -1;
}

.shimmer::after {
    box-shadow: inset 0 0 0 1px hsl(var(--glow-hue) 70% 95%),
        inset 0 0 2px 1px hsl(var(--glow-hue) 100% 80%),
        inset 0 0 5px 2px hsl(var(--glow-hue) 100% 70%);
    z-index: 2;
}

button .text {
    color: transparent;
    background-clip: text;
    background-color: var(--bg);
    background-image: linear-gradient(120deg, transparent, hsla(var(--glow-hue),100%,80%,0.66) 40%, hsla(var(--glow-hue),100%,90%,.9) 50%, transparent 52%);
    background-repeat: no-repeat;
    background-size: 300% 300%;
    background-position: center 200%;
}

button:hover .text,
button.active .text {
    animation: text .66s ease-in 1 both;
}















body,
html {
    display: flex;
    height: 100svh;
    padding: 0;
    margin: 0;
    background-image: radial-gradient(
        circle at 50% 0%,
        rgb(67, 54, 74) 16.4%,
        rgb(47, 48, 67) 68.2%,
        rgb(27, 23, 36) 99.1%
    );
}
main#app {
    height: 100svh;
    width: 100svw;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
