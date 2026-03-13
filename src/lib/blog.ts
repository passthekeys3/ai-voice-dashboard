import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const CONTENT_DIR = path.join(process.cwd(), 'src/content/blog');

export interface PostMeta {
    slug: string;
    title: string;
    description: string;
    date: string;
    author: string;
    tags: string[];
    readingTime: string;
}

export interface Post extends PostMeta {
    content: string;
}

export function getAllPosts(): PostMeta[] {
    if (!fs.existsSync(CONTENT_DIR)) return [];

    const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'));

    const posts = files.map((filename) => {
        const slug = filename.replace(/\.mdx$/, '');
        const filePath = path.join(CONTENT_DIR, filename);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(fileContent);
        const stats = readingTime(content);

        return {
            slug,
            title: data.title || slug,
            description: data.description || '',
            date: data.date || '',
            author: data.author || 'BuildVoiceAI Team',
            tags: data.tags || [],
            readingTime: stats.text,
        };
    });

    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): Post | null {
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
    if (!fs.existsSync(filePath)) return null;

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    const stats = readingTime(content);

    return {
        slug,
        title: data.title || slug,
        description: data.description || '',
        date: data.date || '',
        author: data.author || 'BuildVoiceAI Team',
        tags: data.tags || [],
        readingTime: stats.text,
        content,
    };
}

export function getAllSlugs(): string[] {
    if (!fs.existsSync(CONTENT_DIR)) return [];
    return fs
        .readdirSync(CONTENT_DIR)
        .filter((f) => f.endsWith('.mdx'))
        .map((f) => f.replace(/\.mdx$/, ''));
}
