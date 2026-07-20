import Image from "next/image";

import heroImage from "@/app/assets/sidequest-coast.jpg";
import { SidequestWordmark } from "@/components/SidequestWordmark";

import styles from "./page.module.css";

const PREFILLED_MESSAGE = "hey";

function getStartHref() {
  const phone = process.env.NEXT_PUBLIC_SIDEQUEST_PHONE?.trim();

  return phone
    ? `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`
    : "/signup";
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const startHref = getStartHref();

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <Image
          src={heroImage}
          alt="Three friends cycling through a quiet seaside town in the late afternoon"
          className={styles.heroImage}
          fill
          priority
          placeholder="blur"
          sizes="100vw"
        />
        <div className={styles.heroWash} aria-hidden="true" />

        <header className={styles.header}>
          <a href="#top" className={styles.brandLink} aria-label="Sidequest home">
            <SidequestWordmark className={styles.wordmark} />
          </a>

          <nav className={styles.nav} aria-label="Main navigation">
            <a href="#how" className={styles.navLink}>
              How it begins
            </a>
            <a href={startHref} className={styles.navAction}>
              Text Sidequest
            </a>
          </nav>
        </header>

        <div id="top" className={styles.heroContent}>
          <p className={`${styles.eyebrow} ${styles.heroStepOne}`}>
            A little more life, waiting nearby.
          </p>
          <h1 id="hero-title" className={`${styles.heroTitle} ${styles.heroStepTwo}`}>
            Make a day
            <br />
            worth remembering.
          </h1>
          <p className={`${styles.heroBody} ${styles.heroStepThree}`}>
            Tell Sidequest about one day you loved. When the time is right,
            your next one will be waiting.
          </p>
          <div className={`${styles.heroActions} ${styles.heroStepFour}`}>
            <a href={startHref} className={styles.primaryAction}>
              <span>Start with a memory</span>
              <ArrowIcon />
            </a>
            <span className={styles.actionNote}>Begins in iMessage</span>
          </div>
        </div>

        <a href="#how" className={styles.scrollCue}>
          <span>How it begins</span>
          <span aria-hidden="true" className={styles.scrollLine} />
        </a>

        <p className={styles.photoNote}>A day worth living twice.</p>
      </section>

      <section id="how" className={`${styles.memorySection} ${styles.revealSection}`}>
        <div className={styles.sectionLead}>
          <p className={styles.sectionIndex}>01 / A memory</p>
          <h2>It begins with a day you&apos;d live again.</h2>
          <p>
            Not a quiz. Not a list of interests. Just one honest memory—the
            people, what happened, and why it stayed.
          </p>
        </div>

        <div className={styles.conversation} aria-label="An example Sidequest conversation">
          <p className={styles.messageTime}>Today 11:42 PM</p>
          <div className={`${styles.message} ${styles.agentMessage}`}>
            tell me about a real day you&apos;d live again — the people, what
            happened, and why it stayed. messy is good.
          </div>
          <div className={`${styles.message} ${styles.userMessage}`}>
            we took the last train somewhere we&apos;d never heard of and found a
            tiny beach just before sunset.
          </div>
          <p className={styles.typingLabel}>
            <span aria-hidden="true" /> Sidequest is thinking
          </p>
        </div>
      </section>

      <section className={styles.processSection} aria-labelledby="process-title">
        <div className={`${styles.processIntro} ${styles.revealSection}`}>
          <p className={styles.sectionIndex}>02 / Quietly personal</p>
          <h2 id="process-title">Less searching. More living.</h2>
          <p>
            Sidequest pays attention to the texture of a good day, then waits
            for a real opening in your life.
          </p>
        </div>

        <ol className={`${styles.processList} ${styles.revealSection}`}>
          <li>
            <span className={styles.processNumber}>01</span>
            <div>
              <h3>Remember</h3>
              <p>Share one true story in your own words.</p>
            </div>
            <span className={styles.processAside}>one message</span>
          </li>
          <li>
            <span className={styles.processNumber}>02</span>
            <div>
              <h3>Make room</h3>
              <p>Tell Sidequest when you have a few hours free.</p>
            </div>
            <span className={styles.processAside}>no planning</span>
          </li>
          <li>
            <span className={styles.processNumber}>03</span>
            <div>
              <h3>Go</h3>
              <p>Receive one experience made for this particular moment.</p>
            </div>
            <span className={styles.processAside}>one sidequest</span>
          </li>
        </ol>
      </section>

      <section className={styles.manifestoSection}>
        <div className={`${styles.manifestoInner} ${styles.revealSection}`}>
          <p className={styles.sectionIndex}>03 / Made for real life</p>
          <p className={styles.manifestoText}>
            Not another feed of places you could go.
            <span> One beautiful reason to go now.</span>
          </p>
          <p className={styles.manifestoBody}>
            Your people. Your place. This particular afternoon. Sidequest
            brings them together into something that could only belong to you.
          </p>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className={`${styles.finalInner} ${styles.revealSection}`}>
          <SidequestWordmark className={styles.finalMark} />
          <h2>A few free hours can become the story you keep.</h2>
          <a href={startHref} className={styles.finalAction}>
            <span>Tell me about a day</span>
            <ArrowIcon />
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <SidequestWordmark className={styles.footerMark} />
        <p>Made for lives that could use a little detour.</p>
        <p>© 2026 Sidequest</p>
      </footer>
    </main>
  );
}
