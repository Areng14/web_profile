'use client';

import React from "react";
import Image from 'next/image';

// Technology tags mapping
const techLogos: { [key: string]: string } = {
    // Languages
    "Python": "/misc/skills/monochrome/python.svg",
    "JavaScript": "/misc/skills/monochrome/js.svg",
    "JS": "/misc/skills/monochrome/js.svg",
    "TypeScript": "/misc/skills/monochrome/ts.svg",
    "TS": "/misc/skills/monochrome/ts.svg",
    "Java": "/misc/skills/monochrome/java.svg",
    "Swift": "/misc/skills/monochrome/swift.svg",
    
    // Frameworks
    "React": "/misc/skills/monochrome/react.svg",
    "Electron": "/misc/skills/monochrome/electron.svg",
    "Node.js": "/misc/skills/monochrome/nodejs.svg",
    "NodeJS": "/misc/skills/monochrome/nodejs.svg",
    "Node": "/misc/skills/monochrome/nodejs.svg",
    "Next.js": "/misc/skills/monochrome/nextjs.svg",
    "NextJS": "/misc/skills/monochrome/nextjs.svg",
    "Next": "/misc/skills/monochrome/nextjs.svg",
};

interface ProjectCardProps {
    name: string;
    description: string;
    image?: string;
    gitRepo?: string;
    gradientColors?: string[];
    gradientAngle?: number;
    technologies?: string[]; // Now just accepts technology names
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
    name, 
    description, 
    image, 
    gitRepo,
    gradientColors,
    gradientAngle = 45,
    technologies = []
}) => {
    const goToGitRepo = () => {
        if (gitRepo) {
            window.location.href = `https://github.com/areng14/${gitRepo}`;
        }
    }

    const backgroundStyle = gradientColors ? {
        background: `linear-gradient(${gradientAngle}deg, ${gradientColors.join(', ')})`
    } : {};

    return (
        <div
            className="relative flex w-full max-w-full flex-col overflow-hidden rounded-2xl bg-slate-900"
            style={{ height: "576px" }}
        >
            {/* Image/Gradient Container - Top 50% */}
            <div
                className="relative h-1/2 w-full overflow-hidden"
                style={backgroundStyle}
            >
                {!gradientColors && image && (
                    <Image
                        src={image}
                        alt={name}
                        fill
                        style={{
                            objectFit: "cover",
                        }}
                    />
                )}
                {/* Tags Container */}
                {technologies.length > 0 && (
                    <div
                        className="absolute bottom-4 right-4 flex max-w-[70%] flex-wrap justify-end gap-2"
                    >
                        {technologies.map((tech, index) => (
                            techLogos[tech] && (
                                <div
                                    key={index}
                                    className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-100 p-1.5 transition-transform duration-200 hover:scale-110"
                                    title={tech}
                                >
                                    <Image
                                        src={techLogos[tech]}
                                        alt={tech}
                                        fill
                                        style={{
                                            objectFit: "contain",
                                            padding: "6px"
                                        }}
                                    />
                                </div>
                            )
                        ))}
                    </div>
                )}
            </div>
            
            {/* Content Container - Bottom 75% */}
            <div className="flex h-3/4 flex-col gap-2 px-5 pb-5 pt-2">
                <h2 className="pt-2 text-2xl font-semibold text-white">
                    {name.toUpperCase()}
                </h2>
                <p className="text-slate-200">
                    {description}
                </p>
                {gitRepo && (
                    <button
                        type="button"
                        className="absolute bottom-9 inline-flex rounded-xl bg-[#0c0d0f] px-6 py-3 text-lg font-medium text-slate-100 hover:bg-[#1f2126] hover:text-slate-300"
                        onClick={goToGitRepo}
                    >
                        View Repository
                    </button>
                )}
            </div>
        </div>
    );
}

export default ProjectCard;