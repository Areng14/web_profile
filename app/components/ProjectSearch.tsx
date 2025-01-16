'use client';

import { Box, Grid2, Typography } from "@mui/material";
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from "react";
import { getProjects, type Project } from '../projects/getProjects';
import ProjectCard from "../components/ProjectCard";

const temp_projects = getProjects();

interface ProjectSearchProps {
  initialProjects: Project[];
  initialSearch: string;
}

export default function ProjectSearch({ 
  initialProjects,
  initialSearch 
}: ProjectSearchProps): JSX.Element {
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(initialProjects);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If there's a search query in the URL, scroll the search box into view
    if (searchParams.get('search')) {
      searchBoxRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchParams]);

  const filterProjects = (term: string): void => {
    if (!term) {
      setFilteredProjects(temp_projects);
      return;
    }

    const searchLower = term.toLowerCase();
    const filtered = temp_projects.filter(project => 
      project.name.toLowerCase().includes(searchLower) ||
      project.description.toLowerCase().includes(searchLower) ||
      project.technologies.some(tech => 
        tech.toLowerCase().includes(searchLower)
      )
    );
    setFilteredProjects(filtered);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setSearchTerm(value);
    filterProjects(value);
  };

  return (
    <>
      <Box ref={searchBoxRef} sx={{ width: '100%', mb: 4 }}>
        <TextField
          fullWidth
          type="text"
          placeholder="Search projects by name, description, or technology..."
          value={searchTerm}
          onChange={handleSearch}
          sx={{
            backgroundColor: '#0c0d0f',
            borderRadius: 1,
            input: {
              color: 'white',
              paddingLeft: '14px',
            },
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.23)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
              },
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255, 255, 255, 0.5)',
              opacity: 1,
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {filteredProjects.length > 0 ? (
        <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
          {filteredProjects.map((project) => (
            <Grid2 key={project.id} size={{xs:12, md:6, lg:4}}>
              <ProjectCard
                name={project.name}
                description={project.description}
                gradientColors={project.gradientColors}
                gradientAngle={project.gradientAngle}             
                {...(project.gitRepo
                  ? { gitRepo: project.gitRepo }
                  : {}
                )}
                technologies={project.technologies}
              />
            </Grid2>
          ))}
        </Grid2>
      ) : (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8, 
          fontSize: '1.25rem', 
          color: 'text.secondary' 
        }}>
            <Typography variant="h3" sx={{color: 'white', fontWeight: 700, fontSize: {xs: '2.5rem',sm: '4rem'}}}>
            No projects found
            </Typography>
        </Box>
      )}
    </>
  );
}