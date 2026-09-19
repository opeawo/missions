export type Audience = {
  slug: string;
  nav: string;
  eyebrow: string;
  headline: string;
  lede: string;
  company: {
    title: string;
    body: string;
    bullets: string[];
  };
  developer: {
    title: string;
    body: string;
    bullets: string[];
  };
  example: string;
  credit?: boolean;
};

export const AUDIENCES: Audience[] = [
  {
    slug: "software",
    nav: "Software companies",
    eyebrow: "For software companies",
    headline: "Your product, running in someone else’s repo by Friday.",
    lede: "Docs don’t prove a product. A stranger installing it, wiring it, and writing about what broke — that does.",
    company: {
      title: "If you ship software",
      body: "Paste the product URL. Missions turns it into paid work: developers hit your API, SDK, or app, leave a working example, and talk about it in public.",
      bullets: [
        "Real integrations, not screenshot theatre",
        "Public writeups on GitHub, LinkedIn, X, or a blog",
        "A queue of builders instead of a single hire",
      ],
    },
    developer: {
      title: "If you build software",
      body: "You get paid to learn a product the hard way — by using it. Ship a demo, write what you actually found, keep the repo.",
      bullets: [
        "Clear briefs. One mission, one outcome.",
        "You keep the repo and the post",
        "Claim on the site, in Discord, or from Cursor",
      ],
    },
    example: "A payments API that needs a Next.js checkout, a Python webhook, and a post that isn’t a press release.",
  },
  {
    slug: "ai",
    nav: "AI companies",
    eyebrow: "For AI companies",
    headline: "Models don’t spread through decks. They spread through traces.",
    lede: "If the only people who have used your model are on your payroll, you don’t have distribution. You have a lab.",
    company: {
      title: "If you ship models or agents",
      body: "Missions puts developers on the thing itself: evals, agents, RAG, voice, tools. They leave demos other people can click, and posts other people will believe.",
      bullets: [
        "Builders who have shipped with models, not just tweeted about them",
        "Public notebooks, apps, and evals you can point to",
        "A mix of geographies so the work isn’t all one timezone and one price",
      ],
    },
    developer: {
      title: "If you work with models",
      body: "Paid missions to wire a model into something real. Not another chatbot tutorial — a product, with a URL, and a writeup.",
      bullets: [
        "Work that belongs in a portfolio",
        "You choose the stack; the brief names the outcome",
        "Reward posted up front, paid when the company accepts the proof",
      ],
    },
    example: "A new transcription model that needs a call-center demo, a latency bake-off, and three engineers talking about it on X.",
  },
  {
    slug: "fde",
    nav: "FDE as a service",
    eyebrow: "FDE as a service",
    headline: "Forward-deployed, without the headcount.",
    lede: "You don’t need a bench of embedded engineers. You need the next customer’s problem solved in their repo, this week, by someone who already knows how to sit in the mess.",
    company: {
      title: "If you sell into messy production",
      body: "Paste the product. Missions writes the briefs: integrate with their auth, their warehouse, their support tool. Developers do the FDE work. You keep the relationship.",
      bullets: [
        "Integration missions scoped to a real customer shape",
        "Proof is a working path, not a slide",
        "Scale the bench up and down without hiring",
      ],
    },
    developer: {
      title: "If you like customer-shaped problems",
      body: "These missions pay you to be the person who makes the product work in a real stack — then leave notes so the next person isn’t lost.",
      bullets: [
        "Ambiguous on purpose. That’s the job.",
        "You will read someone else’s code",
        "The writeup is part of the deliverable. Teach it.",
      ],
    },
    example: "A data platform that “works with Snowflake” until a developer actually has to make it work with Snowflake.",
  },
  {
    slug: "evangelists",
    nav: "Developer evangelists",
    eyebrow: "Developer evangelist as a service",
    headline: "DevRel as a queue of missions, not a content calendar.",
    lede: "A good evangelist builds the thing, then talks. Missions pays people to do both — so the posts have a repo behind them.",
    company: {
      title: "If you need developers talking about you",
      body: "Don’t commission threads. Commission work. Each mission is a build plus a public post. You get artifacts and a voice, from people whose audience already cares about this kind of tool.",
      bullets: [
        "Build + publish in the same brief",
        "LinkedIn, X, Substack, GitHub — you pick the floor",
        "No retainer. Pay when the work is accepted",
      ],
    },
    developer: {
      title: "If you already explain things in public",
      body: "Get paid to use a product hard enough that you have something true to say. The demo is the post. The post is the proof.",
      bullets: [
        "You keep the voice. The brief keeps the facts.",
        "Reach helps, relevance helps more",
        "Same mission, different people, different stories",
      ],
    },
    example: "An SDK that needs five public examples and five posts that don’t sound like they were written in a war room.",
  },
  {
    slug: "startups",
    nav: "Startups",
    eyebrow: "For startups",
    headline: "You don’t have a DevRel team. You have a URL and a week.",
    lede: "Paste the site. Get a developer on it before the deck is finished.",
    company: {
      title: "If you’re early",
      body: "Paste the site. We’ll suggest what to ask for: a demo, an integration, a public note. You pick how many people. You fund once. They ship.",
      bullets: [
        "$50 credit on your first launch",
        "Start from a URL, not a 12-field form",
        "Keep leftover budget for the next round of missions",
      ],
    },
    developer: {
      title: "If you like unfinished products",
      body: "Startups pay you to be user zero with a job to do. The product will move under you. That’s why the writeup matters.",
      bullets: [
        "Smaller briefs, faster cycles",
        "You’re early in the story on purpose",
        "Claim, ship, get paid. Then do another.",
      ],
    },
    example: "A four-person company that needs three developers to use the beta, break it, and say so in public.",
    credit: true,
  },
];

export function audienceBySlug(slug: string): Audience | undefined {
  return AUDIENCES.find((item) => item.slug === slug);
}
