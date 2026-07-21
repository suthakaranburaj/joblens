export default function HomePage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        JobLens
      </h1>
      <p className="mt-3 max-w-lg text-base text-muted-foreground sm:text-lg">
        Paste a job URL to analyze requirements, culture signals, and red flags
        — optionally match against your resume.
      </p>
    </section>
  );
}
