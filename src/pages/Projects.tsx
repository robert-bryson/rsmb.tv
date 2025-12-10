import { Link } from 'react-router-dom';

export function Projects() {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-purple-200 mb-4">Projects</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <Link to="/projects/flights" className="text-blue-300 hover:underline">
            Flights
          </Link>
          <span className="text-gray-400"> – A 3D webmap of places I've been</span>
        </li>
        <li>
          <span className="text-gray-300">Project 2</span>
          <span className="text-gray-400"> – Description</span>
        </li>
      </ul>
    </section>
  );
}
