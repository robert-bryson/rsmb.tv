import { Link } from 'react-router-dom';

export default function Projects () {
    return (
        <section>
            <h2 className="text-2xl font-semibold text-purple-200 mb-2">Projects</h2>
            <ul className="list-disc pl-5">
            <li>
                <Link to='/projects/flights' className='text-blue-300 hover:underline'>
                Flights - A 3D webmap of flights flown
                </Link>
            </li>
            <li>Project 2 - Description</li>
            </ul>
        </section>
    )
};
