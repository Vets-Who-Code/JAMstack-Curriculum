#!/usr/bin/env node

import { simpleGit, SimpleGit, CleanOptions, SimpleGitOptions } from 'simple-git';
import process from 'node:process';
import fetch from 'node-fetch';
import fs from 'node:fs';
import path from 'node:path';

const vwcRemote = 'git@github.com:Vets-Who-Code/web-curriculum.git';
type TargetType = 'syllabus' | 'subject';
const buildUrl = (target: TargetType, fileName: string = '') => {
    const root = 'http://raw.githubusercontent.com/axecopfire/graph-curric/main/';
    switch (target) {
        case 'syllabus':
            return root + 'public/content/Base/Syllabus.md';
        case 'subject':
            return root + 'public/content/md/' + fileName + '.md';
    }
}

const buildContentPath = (contentPath: string) => path.join(process.cwd(), 'md', contentPath);
const cheapMkdir = (p: string) => {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p);
    }
}

const main = async () => {
    const syllabus = await fetch(buildUrl('syllabus')).then(r => r.text());

    // Parse the syllabus file for lesson paths
    const lessonList = syllabus.split('\r').map(l => l.replace('\n', '')).reduce((acc: string[], line) => {
        if (!line.startsWith('- ')) return acc;
        return [...acc, line.replace('- ', '')];
    }, []);

    // Get all the lesson text
    const rawLessons = await Promise.all(lessonList.map(async lesson => {
        const lessonUrl = buildUrl('subject', lesson)
        const lessonText = await fetch(lessonUrl).then(r => r.text());
        return {
            text: lessonText,
            subject: lesson
        }
    }))

    // Update syllabus
    const syllabusPath = path.join(process.cwd(), 'README.md');
    fs.writeFileSync(syllabusPath, syllabus);

    // Ensure the md folder exists
    const mdFolderPath = buildContentPath('');
    cheapMkdir(mdFolderPath)

    // Write all the lesson files
    rawLessons.forEach(({ text, subject }) => {
        const [folder, file] = subject.split('/');
        const subjectFolder = buildContentPath(folder);
        const contentPath = buildContentPath(`${folder}/${file}.md`)

        cheapMkdir(subjectFolder);

        fs.writeFileSync(contentPath, text);
    });




    // const options: Partial<SimpleGitOptions> = {
    //     baseDir: process.cwd(),
    //     binary: 'git',
    //     maxConcurrentProcesses: 6,
    //     trimmed: false,
    // };

    const git: SimpleGit = simpleGit();
    try {
        await git.addRemote('origin', vwcRemote);
    } catch (error) {
        if (!(error instanceof Error)) {
            throw new Error(`unexpected error fetching remote origin \n${error}`);
        }
        // If local should fail since the remote is already configed
        if (!error.message.includes('remote origin already exists.')) {
            throw error;
        }
    }

    // Ensure remote origin is what we want
    const remotes = await git.getRemotes(true);
    remotes.forEach(r => {
        if (r.name === 'origin') {
            if (r.refs.fetch !== vwcRemote) {
                throw new Error("VWC remote url isnt setup");
            }
        }
    });

    if (!process.env.DRY_RUN) {
        console.log('Updating Git with new generated curriculum');
        git.add(process.cwd() + '*')
            // TODO: ADD PR #
            .commit('Automated commit')
            .push('origin', 'master');
    }
}

main();