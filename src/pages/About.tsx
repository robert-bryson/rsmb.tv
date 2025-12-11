export function About() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">About</h1>
      
      <div className="prose space-y-4">
        <p>
          I'm a software developer based in St. Louis with a background in 
          geospatial engineering. I started out building GIS applications for 
          county and state governments, then moved into startup land doing 
          geospatial backend work.
        </p>
        
        <p>
          I spent several years at Microsoft working on Azure Maps and location 
          services. Now I'm at{' '}
          <a href="https://xentity.com" target="_blank" rel="noopener noreferrer">Xentity</a>, 
          where I work on federal projects including{' '}
          <a href="https://data.gov" target="_blank" rel="noopener noreferrer">Data.gov</a>{' '}
          and USFS Enterprise Geospatial Platform applications.
        </p>

      </div>

      {/* Experience */}
      <section className="mt-12">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-4">
          Experience
        </h2>
        <ul className="space-y-4 text-sm">
          <li className="flex gap-4">
            <span className="text-zinc-600 w-28 shrink-0">Xentity</span>
            <span className="text-zinc-300">Federal geospatial projects — Data.gov, USFS EGP</span>
          </li>
          <li className="flex gap-4">
            <span className="text-zinc-600 w-28 shrink-0">Microsoft</span>
            <span className="text-zinc-300">Geospatial Engineer — Azure Maps, location services</span>
          </li>
          <li className="flex gap-4">
            <span className="text-zinc-600 w-28 shrink-0">Startups</span>
            <span className="text-zinc-300">Geospatial backend engineering</span>
          </li>
          <li className="flex gap-4">
            <span className="text-zinc-600 w-28 shrink-0">State/County</span>
            <span className="text-zinc-300">GIS applications for government agencies</span>
          </li>
        </ul>
      </section>
      
      {/* Contact */}
      <section className="mt-12">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-4">
          Connect
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a 
              href="https://github.com/robert-bryson" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-violet-400"
            >
              GitHub
            </a>
          </li>
          <li>
            <a 
              href="https://linkedin.com/in/robert-bryson" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-violet-400"
            >
              LinkedIn
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
