'use client';

import { Box, Grid2, Typography } from "@mui/material";
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
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

  const handleKeyPress = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      // Update URL only on Enter
      const params = new URLSearchParams(searchParams.toString());
      if (searchTerm) {
        params.set('search', searchTerm);
      } else {
        params.delete('search');
      }
      router.push(`/projects?${params.toString()}`);
    }
  };

  return (
    <>
      <Box ref={searchBoxRef} sx={{ width: '100%', maxWidth: '42rem', mx: 'auto', mb: 4 }}>
        <TextField
          fullWidth
          type="text"
          placeholder="Search projects by name, description, or technology..."
          value={searchTerm}
          onChange={handleSearch}
          onKeyPress={handleKeyPress}
          sx={{
            backgroundColor: 'white',
            borderRadius: 1,
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(0, 0, 0, 0.23)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(0, 0, 0, 0.23)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
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