# Rōmy

[intel.getromy.app](https://intel.getromy.app)

**Rōmy** helps small nonprofits find new major donors at a fraction of the cost of existing solutions.

![Rōmy cover](./public/cover_romy.jpg)

## Features

- Multi-model support via OpenRouter (GPT-4, Claude, Gemini, and more)
- Bring your own API key (BYOK) support
- File uploads
- Clean, responsive UI with light/dark themes
- Built with Tailwind CSS, shadcn/ui, and prompt-kit
- Open-source and self-hostable
- Customizable: user system prompt, multiple layout options
- Full MCP support (wip)

## Quick Start

```bash
git clone https://github.com/ibelick/romy.git
cd romy
npm install
echo "OPENROUTER_API_KEY=your-key" > .env.local
npm run dev
```

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ibelick/romy)

To unlock features like auth, file uploads, see [INSTALL.md](./INSTALL.md).

## Built with

- [prompt-kit](https://prompt-kit.com/) — AI components
- [shadcn/ui](https://ui.shadcn.com) — core components
- [motion-primitives](https://motion-primitives.com) — animated components
- [vercel ai sdk](https://vercel.com/blog/introducing-the-vercel-ai-sdk) — model integration, AI features
- [supabase](https://supabase.com) — auth and storage

## Sponsors

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

## License

Apache License 2.0

## Notes

This is a beta release. The codebase is evolving and may change.
