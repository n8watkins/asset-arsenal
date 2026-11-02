import type { Metadata } from "next";
import { LegalPage } from "@/components/Chrome";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <LegalPage title="Terms">
      <p>
        Asset Arsenal is a concept in development. This page describes what it is meant to do; nothing here is a promise of
        features, prices or dates.
      </p>
      <h2>Styles, not other people&rsquo;s work</h2>
      <p>
        When it ships, you will be able to ask for a style or a feel, not for someone else&rsquo;s characters, logos or
        trademarks. Only upload images you have the right to use.
      </p>
      <h2>Contact</h2>
      <p>
        Questions go through the contact page on n8builds.dev.
      </p>
    </LegalPage>
  );
}
