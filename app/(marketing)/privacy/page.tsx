import type { Metadata } from "next";
import { Container, Section } from "@/components/ui";
import { Prose, LegalHeader } from "@/components/marketing/Prose";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} collects, uses, and retains your data.`,
};

export default function PrivacyPage() {
  return (
    <Section>
      <Container className="max-w-3xl">
        <LegalHeader title="Privacy Policy" updated="June 8, 2026" />
        <Prose>
          <p>
            This Privacy Policy explains what {SITE.name} collects, how we use
            it, and how long we keep it. We aim to collect only what we need to
            run the Service.
          </p>

          <h2>1. Information we collect</h2>
          <ul>
            <li>
              <strong>Account information.</strong> When you sign in with Google,
              we receive your name and email address from your Google account. We
              use these to identify your account and contact you about the
              Service.
            </li>
            <li>
              <strong>Uploaded images.</strong> The design images you upload are
              processed to detect icon styles and generate outputs.
            </li>
            <li>
              <strong>Generated content.</strong> The icons, prompts, and
              manifest metadata produced from your uploads.
            </li>
            <li>
              <strong>Usage data.</strong> Basic analytics about how the Service
              is used (pages visited, actions taken, device and browser
              information), collected via Google Analytics 4 (GA4).
            </li>
            <li>
              <strong>Billing data.</strong> Payments are handled by our payment
              processor; we do not store full card numbers.
            </li>
          </ul>

          <h2>2. How we use information</h2>
          <ul>
            <li>To provide, operate, and improve the Service.</li>
            <li>To generate icons from your uploads and deliver your packs.</li>
            <li>To process payments and manage your credit balance.</li>
            <li>To understand usage and improve performance via GA4.</li>
            <li>To communicate about your account and important changes.</li>
          </ul>

          <h2>3. Data retention</h2>
          <p>We do not keep your files longer than we need to:</p>
          <ul>
            <li>
              <strong>Source images</strong> are deleted automatically{" "}
              <strong>7 days</strong> after upload.
            </li>
            <li>
              <strong>Generated packs</strong> are retained for{" "}
              <strong>30 days</strong> unless you explicitly save them to your
              account.
            </li>
            <li>
              Account and billing records are retained as required for legal,
              tax, and accounting purposes.
            </li>
          </ul>

          <h2>4. Analytics</h2>
          <p>
            We use Google Analytics 4 to understand aggregate usage patterns.
            GA4 may set cookies and collect device and interaction data. This
            helps us improve the product; it is not used to sell your personal
            data.
          </p>

          <h2>5. Sharing</h2>
          <p>
            We share data only with service providers who help us operate the
            Service (such as hosting, AI generation, analytics, and payment
            processing), and only as needed to perform those functions. We do not
            sell your personal information.
          </p>

          <h2>6. Security</h2>
          <p>
            We use reasonable technical and organizational measures to protect
            your data. No method of transmission or storage is perfectly secure,
            so we cannot guarantee absolute security.
          </p>

          <h2>7. Your choices</h2>
          <ul>
            <li>
              You can delete uploaded images and generated packs from within the
              app.
            </li>
            <li>
              You can request deletion of your account and associated data.
            </li>
            <li>
              You can manage analytics cookies through your browser settings.
            </li>
          </ul>

          <h2>8. Changes</h2>
          <p>
            We may update this Policy from time to time. The &ldquo;Last
            updated&rdquo; date above reflects the latest version.
          </p>

          <h2>9. Contact</h2>
          <p>
            For privacy questions or data requests, contact us through the
            options on our site.
          </p>
        </Prose>
      </Container>
    </Section>
  );
}
