import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';

export function NotFound() {
    useDocumentHead({
        title: 'Page Not Found',
        description: "The page you're looking for doesn't exist.",
    });

    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <h1 className="text-4xl font-bold text-zinc-100 mb-2">404</h1>
            <p className="text-zinc-400 mb-6">The page you're looking for doesn't exist.</p>
            <Link to="/" className="text-violet-400 hover:text-violet-300">
                ← Back to home
            </Link>
        </div>
    );
}
