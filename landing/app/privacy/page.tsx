import type { Metadata } from "next";
import { LegalPage } from "@/components/Chrome";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <p>This is a concept page. It has no accounts, no forms and no cookies.</p>
      <h2>Analytics</h2>
      <p>
        The site uses Cloudflare Web Analytics, which is cookieless, does not store IP addresses and counts visits without
        tracking anyone.
      </p>
      <h2>The waitlist</h2>
      <p>
        The waitlist lives on n8builds.dev, where Asset Arsenal is built in public. If you join it there, n8builds.dev
        handles your email under its own privacy policy, and uses it only to tell you when there is something to try.
      </p>
      <h2>When the product exists</h2>
      <p>
        Pages and images you upload will be used only for your own runs, sent to the image model provider that does the
        work, and deleted when you delete the project. This page will say exactly how before anything ships.
      </p>
    </LegalPage>
  );
}
