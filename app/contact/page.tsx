// app/contact/page.tsx
import { Metadata } from "next";
import ImageSlider from "../components/ImageSlider";

const images: string[] = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: "Contact",
    description: "How to contact me",
  };
};

export default function Contact() {
  return (
    <div>
      <section className="relative flex min-h-screen items-center">
        <ImageSlider imgs={images} />
        <div className="z-10 mx-auto flex w-full max-w-[1600px] px-4 py-8">
          <div className="max-w-xl space-y-6">
            <h1 className="break-words text-4xl font-bold md:text-5xl">
              Contact
            </h1>
            <p className="max-w-[60%] text-sm text-slate-200 md:max-w-[50%] md:text-base">
              A list of ways you can contact me for whatever reason. I am mainly
              active on Discord, and I check my email every now and then. Choose
              whatever way is most convenient for you.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pt-16">
        <div className="mx-auto max-w-[1600px] px-4">
          {/* You can add actual contact methods here later */}
        </div>
      </section>
    </div>
  );
}

