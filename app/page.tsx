import ImageSlider from "./components/ImageSlider";
import SkillCard from "./components/SkillCard";

export default function Home() {
  const images = [
    "/misc/mainslide/img1.png",
    "/misc/mainslide/img2.png",
    "/misc/mainslide/img3.png",
    "/misc/mainslide/img4.png",
  ];

  return (
    <div>
      <section className="relative flex min-h-screen items-center">
        <ImageSlider imgs={images} />
        <div className="z-10 mx-auto flex w-full max-w-[1600px] px-4 py-8">
          <div className="max-w-xl space-y-6">
            <h1 className="break-words text-4xl font-bold md:text-6xl">
              Areng
              <br />
              Teanpakdeeprasat
            </h1>
            <p className="max-w-[60%] text-sm md:max-w-[50%] md:text-base text-slate-200">
              A software developer who makes programs in his free time, ranging
              from things that are useless to things that are kinda useful. I
              try to keep my projects as clean and readable as possible.
            </p>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="pt-16">
        <div className="mx-auto max-w-[1600px] px-4">
          <h2 className="text-4xl font-bold sm:text-6xl">Skills</h2>

          {/* Languages */}
          <h3 className="pt-6 text-3xl font-medium sm:text-[3.75rem]">
            Languages
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SkillCard
              skill="Python"
              colors={["rgb(22, 167, 105)", "rgb(17, 133, 159)", "rgb(6, 99, 198)"]}
              angle="45deg"
              icon={"/misc/skills/python.svg"}
              endpoint="/projects?search=Python"
            />
            <SkillCard
              skill="JS"
              colors={["rgb(210, 116, 1)", "rgb(202, 131, 0)", "rgb(186, 159, 2)"]}
              angle="45deg"
              icon={"/misc/skills/js.svg"}
              endpoint="/projects?search=JavaScript"
            />
            <SkillCard
              skill="TS"
              colors={["rgb(0, 93, 155)", "rgb(35, 112, 154)", "rgb(62, 133, 177)"]}
              angle="45deg"
              icon={"/misc/skills/ts.svg"}
              endpoint="https://www.typescriptlang.org"
            />
            <SkillCard
              skill="Java"
              colors={["rgb(1, 51, 79)", "rgb(0, 116, 183)", "rgb(72, 153, 188)"]}
              angle="45deg"
              icon={"/misc/skills/java.svg"}
              endpoint="/projects?search=Java"
            />
            <SkillCard
              skill="Swift"
              colors={["rgb(212, 47, 39)", "rgb(209, 81, 49)", "rgb(212, 124, 0)"]}
              angle="45deg"
              icon={"/misc/skills/swift.svg"}
              endpoint="/projects?search=Swift"
            />
          </div>

          {/* Frameworks */}
          <h3 className="pt-6 text-3xl font-medium sm:text-[3.75rem]">
            Frameworks
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SkillCard
              skill="React"
              colors={["rgb(80, 179, 207)", "rgb(0, 98, 123)"]}
              angle="45deg"
              icon={"/misc/skills/react.svg"}
              iconangle={45}
              endpoint="/projects?search=React"
            />
            <SkillCard
              skill="Electron"
              colors={["rgb(159, 234, 249)", "rgb(71, 132, 143)", "rgb(47, 84, 150)"]}
              angle="45deg"
              icon={"/misc/skills/electron.svg"}
              endpoint="/projects?search=Electron"
            />
            <SkillCard
              skill="Node.JS"
              colors={["rgb(40, 123, 40)", "rgb(47, 152, 47)", "rgb(72, 177, 72)"]}
              angle="45deg"
              icon={"/misc/skills/nodejs.svg"}
              endpoint="/projects?search=Node.JS"
            />
            <SkillCard
              skill="Next.JS"
              colors={["rgb(0, 0, 0)", "rgb(44, 44, 44)", "rgb(79, 79, 79)"]}
              angle="45deg"
              icon={"/misc/skills/nextjs.svg"}
              endpoint="/projects?search=Next.JS"
            />
          </div>

          {/* Design */}
          <h3 className="pt-6 text-3xl font-medium sm:text-[3.75rem]">
            Design Tools
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SkillCard
              skill="Adobe Suite"
              colors={["rgb(217, 31, 75)", "rgb(188, 43, 127)", "rgb(139, 31, 211)"]}
              angle="45deg"
              icon={"/misc/skills/adobe.svg"}
              endpoint="/projects?search=Adobe"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

