import Header from "@/components/header"
import Footer from "@/components/footer"
import Hero from "@/components/home/hero"
import SegmentStrip from "@/components/home/segment-strip"
import TrustSection from "@/components/home/trust-section"
import LeadForm from "@/components/home/lead-form"
import ValueStory from "@/components/home/value-story"
import HowItWorks from "@/components/home/how-it-works"
import UsageAreas from "@/components/home/usage-areas"
import FAQ from "@/components/home/faq"
import CTAFinal from "@/components/home/cta-final"

export default function HomePage() {
  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <Header />
      <main>
        <Hero />
        <SegmentStrip />
        <TrustSection />
        <LeadForm />
        <ValueStory />
        <HowItWorks />
        <UsageAreas />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
    </div>
  )
}
