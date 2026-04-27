import { AmbientPointer } from "./components/AmbientPointer";
import { FloatingBlobs } from "./components/FloatingBlobs";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Navbar } from "./components/Navbar";
import { PreviewCarousel } from "./components/PreviewCarousel";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <FloatingBlobs />
      <Navbar />
      <AmbientPointer className="relative flex-1">
        <main className="min-h-0 w-full">
          <Hero />
          <PreviewCarousel />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
