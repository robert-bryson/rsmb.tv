import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';

export function About() {
  usePageMetadata(staticPageMetadata('/about'));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">About</h1>

      <div className="prose space-y-4">
        <p>
          I'm a software developer based in St. Louis with a background in
          geospatial engineering. I started out building GIS applications for
          county and state governments, then moved into startups doing
          geospatial backend development.
        </p>

        <p>
          I spent several years at Microsoft working on Azure Cloud Infrastructure and Operations.
          Now I'm at{' '}
          <a href="https://xentity.com" target="_blank" rel="noopener noreferrer">Xentity</a>,
          where I work on federal projects including{' '}
          <a href="https://data.gov" target="_blank" rel="noopener noreferrer">Data.gov</a>{' '}
          and{' '}
          <a href="https://egp.wildfire.gov/egp/" target="_blank" rel="noopener noreferrer">USFS Enterprise Geospatial Platform</a>{' '}
          applications.
        </p>

      </div>

      {/* Experience */}
      <section className="mt-12">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-4">
          Experience
        </h2>
        <ul className="space-y-4 text-sm">
          <li className="flex gap-4">
            <span className="text-zinc-500 w-28 shrink-0">Xentity</span>
            <span className="text-zinc-300">Federal geospatial projects — Data.gov, USFS EGP</span>
          </li>
          <li className="flex gap-4">
            <span className="text-zinc-500 w-28 shrink-0">Microsoft</span>
            <span className="text-zinc-300">Geospatial Engineer — Azure Cloud Infrastructure and Operations</span>
          </li>
          <li className="flex gap-4">
            <span className="text-zinc-500 w-28 shrink-0">Startups</span>
            <span className="text-zinc-300">Geospatial backend engineering</span>
          </li>
          <li className="flex gap-4">
            <span className="text-zinc-500 w-28 shrink-0">State/County</span>
            <span className="text-zinc-300">GIS applications for government agencies</span>
          </li>
        </ul>
      </section>

      {/* Contact */}
      <section className="mt-12">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-4">
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
              href="https://peakbagger.com/climber/Climber.aspx?cid=2884"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-violet-400"
            >
              Peakbagger
            </a>
          </li>
          <li>
            <a
              href="https://www.mountainproject.com/user/107186573/rsmb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-violet-400"
            >
              Mountain Project
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
