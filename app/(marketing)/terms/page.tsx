import type { Metadata } from "next";
import { Container, Section } from "@/components/ui";
import { Prose, LegalHeader } from "@/components/marketing/Prose";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms governing your use of ${SITE.name}.`,
};

export default function TermsPage() {
  return (
    <Section>
      <Container className="max-w-3xl">
        <LegalHeader title="Terms of Service" updated="June 8, 2026" />
        <Prose>
          <p>
            These Terms govern your access to and use of {SITE.name} (the
            &ldquo;Service&rdquo;). By creating an account or using the Service,
            you agree to these Terms. If you do not agree, do not use the
            Service.
          </p>

          <h2>1. What the Service does</h2>
          <p>
            {SITE.name} accepts a design image you upload and produces individual
            icon images in a style matched to that image. The outputs are{" "}
            <strong>AI-generated recreations</strong>. The Service does not
            recover, extract, or return the original vector layers, source
            files, or assets contained in your image. Outputs are new images
            generated to resemble a detected style.
          </p>

          <h2>2. Your content and rights</h2>
          <p>
            You retain ownership of the images you upload. You are solely
            responsible for ensuring you have the rights to upload any image and
            to create derivative works from it. By uploading, you represent that:
          </p>
          <ul>
            <li>
              You own the image or have a valid license that permits this use.
            </li>
            <li>
              Your upload does not infringe any third party&rsquo;s intellectual
              property, privacy, or other rights.
            </li>
            <li>
              The image does not contain unlawful, infringing, or prohibited
              content.
            </li>
          </ul>
          <p>
            You grant us a limited license to process your uploaded image solely
            to provide the Service (analysis, style detection, and icon
            generation). We do not claim ownership of your uploads.
          </p>

          <h2>3. Outputs and licensing</h2>
          <p>
            Subject to these Terms and your payment of any applicable credits,
            you may use the icons you generate, including for commercial
            purposes. Because outputs are derived from your source image, your
            rights in the outputs depend on your rights in that source image. We
            make no guarantee that any output is free of similarity to other
            works, or is eligible for trademark or copyright protection.
          </p>

          <h2>4. Credits and payment</h2>
          <p>
            The Service runs on a credit model: one credit generates one icon.
            Credits are purchased in packs and are described on our pricing page.
            Purchased credits do not expire; free and promotional credits may.
            Payment, refunds, and failures are further described in our{" "}
            <a href="/refunds">Refund Policy</a>.
          </p>

          <h2>5. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Upload content you lack the rights to use.</li>
            <li>
              Attempt to reverse engineer, overload, or disrupt the Service.
            </li>
            <li>
              Use the Service to generate unlawful, infringing, or harmful
              material.
            </li>
          </ul>

          <h2>6. Disclaimers</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; without warranties of any
            kind. AI generation is probabilistic; we do not warrant that outputs
            will match your expectations, be error-free, or be fit for a
            particular purpose. You are responsible for reviewing outputs before
            use.
          </p>

          <h2>7. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, {SITE.name} and its operators
            will not be liable for any indirect, incidental, or consequential
            damages, or for any loss arising from your use of generated outputs.
            Our total liability for any claim is limited to the amount you paid
            for the credits at issue.
          </p>

          <h2>8. Changes</h2>
          <p>
            We may update these Terms from time to time. Material changes will be
            reflected by the &ldquo;Last updated&rdquo; date above. Continued use
            after changes take effect constitutes acceptance.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions about these Terms? Reach us through the contact options on
            our site.
          </p>
        </Prose>
      </Container>
    </Section>
  );
}
