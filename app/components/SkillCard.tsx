'use client';

import React from "react";
import Image from 'next/image'

interface SkillCardProps {
    skill: string;
    icon: string;
    iconangle?: number;
    colors: string[];
    angle?: string;
    endpoint?: string;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill = "None", icon, colors, angle = "45deg", iconangle=0, endpoint}) => {

    return (
        <div className="relative overflow-hidden rounded-2xl">
            <div
                className="absolute bottom-2 right-2 h-3/4 w-3/4 transition-transform duration-300"
                style={{ transform: `rotate(${iconangle}deg)` }}
            >
                <Image
                    src={icon}
                    alt=""
                    width={500}
                    height={500}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                    }}
                />
            </div>
            <div
                className="relative flex h-[576px] flex-col rounded-2xl p-5"
                style={{
                    background: `linear-gradient(${angle}, ${colors.join(", ")})`,
                }}
            >
                <h2 className="text-2xl font-semibold text-white">
                    {skill.toUpperCase()}
                </h2>
                <a
                    href={endpoint}
                    className="absolute bottom-9 inline-flex rounded-xl bg-[#0c0d0f] px-6 py-3 text-lg font-medium text-slate-100 hover:bg-[#1f2126] hover:text-slate-300"
                >
                    Find Projects
                </a>
            </div>
        </div>
    );
}

export default SkillCard;