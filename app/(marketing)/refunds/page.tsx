import type { Metadata } from "next";
import { Container, Section } from "@/components/ui";
import { Prose, LegalHeader } from "@/components/marketing/Prose";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: `When credits and payments are refundable on ${SITE.name}.`,
};

export default function RefundsPage() {
  return (
    <Section>
      <Container className="max-w-3xl">
        <LegalHeader title="Refund Policy" updated="June 8, 2026" />
        <Prose>
          <p>
            {SITE.name} sells credits that you spend to generate icons (one
            credit per icon). Because generation consumes real compute the moment
            you run it, this policy explains exactly when credits and payments
            are refundable.
          </p>

          <h2>1. System and API failures are refunded</h2>
          <p>
            If a generation fails due to a problem on our side — a system error,
            an upstream AI/API outage, or a failed delivery — you are{" "}
            <strong>not charged</strong> a credit for that icon. If a credit was
            deducted for a failed generation, it is automatically returned to
            your balance. If you believe a failed run was not credited back,
            contact us and we will make it right.
          </p>

          <h2>2. Disliked outputs are not refunded — they&rsquo;re regenerated</h2>
          <p>
            AI generation is subjective and probabilistic. If you don&rsquo;t
            like how an icon turned out, that is not a system failure, so the
            credit is not refunded. Instead, you can{" "}
            <strong>regenerate</strong> the icon to get a fresh take.
            Regeneration uses a credit like any other generation, unless the
            regeneration itself fails for a system reason.
          </p>

          <h2>3. Unused credits</h2>
          <p>
            Credits you purchase do not expire and remain on your account until
            you use them. We do not provide cash refunds for unused purchased
            credits except where required by law. Free and promotional credits
            may carry an expiry and have no cash value.
          </p>

          <h2>4. Billing errors</h2>
          <p>
            If you were charged incorrectly — for example, a duplicate charge or
            a charge for a pack you did not buy — contact us with your account
            details and we will investigate and refund any verified error.
          </p>

          <h2>5. How to request help</h2>
          <p>
            To report a failed generation that wasn&rsquo;t credited, a billing
            error, or any other issue, reach out through the contact options on
            our site. Please include your account email and the relevant run or
            order details so we can resolve it quickly.
          </p>

          <h2>6. Changes</h2>
          <p>
            We may update this policy from time to time. The &ldquo;Last
            updated&rdquo; date above reflects the current version.
          </p>
        </Prose>
      </Container>
    </Section>
  );
}
