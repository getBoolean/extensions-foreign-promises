import {Chapter, Manga, MangaStatus, MangaTile, Tag, TagSection, SearchRequest} from 'paperback-extensions-common'
import {reverseLangCode} from "./Languages"

const LM_DOMAIN = 'https://www.lelmangavf.com';
export class LelmangavfParser {


    parseMangaDetails($: CheerioSelector, mangaId: string): Manga {
        const panel = $('.row').first();
        const table = $('.dl-horizontal', panel).first();
        const title = $('.widget-title', panel).first().text() ?? 'No title';
        const titles = [this.decodeHTMLEntity(title)]
        const image = ($('img', panel).attr('src') ?? '' ).replace('//', 'https://');
        const author = $('.dl-horizontal dd:nth-child(6)').text().replace(/\r?\n|\r/g, '');
        const artist = $('.dl-horizontal dd:nth-child(8)').text().replace(/\r?\n|\r/g, '');
        const rating = Number($(".rating div[id='item-rating']").attr('data-score'));
        const status = $('.dl-horizontal dd:nth-child(8)').text().replace(/\r?\n|\r/g, '').trim() == 'Ongoing' ? MangaStatus.ONGOING : MangaStatus.COMPLETED;
        const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] })];

        // Genres
        const elems = $('.tag-links', table).children();
        const genres: string[] = Array.from(elems, x=>$(x).text() );
        tagSections[0].tags = genres.map((elem: string) => createTag({ id: elem, label: elem }));
        const hentai = genres.includes('Mature') ? true : false;

        // Date
        const dateModified = $('.chapters .date-chapter-title-rtl').first().text().trim() ?? '';
        const time = new Date(dateModified);
        const lastUpdate = time.toDateString();

        // Alt Titles
        const altTitles = $('.dl-horizontal dd:nth-child(4)').text().trim().split(', ');
        for (const alt of altTitles) {
            const parsedAlt = (this.decodeHTMLEntity(alt)).trim();
            titles.push(parsedAlt);
        }

        // Description
        let summary = $('.well', panel).children().last().text().replace(/^\s+|\s+$/g, '');

        return createManga({
            id: mangaId,
            titles,
            image,
            rating: Number(rating),
            status,
            artist,
            author: this.decodeHTMLEntity(author ?? ''),
            tags: tagSections,
            // views,
            // follows,
            lastUpdate,
            desc: this.decodeHTMLEntity(summary),
            hentai
        })
    }


    parseChapterList($: CheerioSelector, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        const allChapters = $('.chapters li[class^="volume-"]').toArray()
        for (const chapter of allChapters) {
            const item = $('.chapter-title-rtl', chapter);
            const chapterId = $('a', item).attr('href');
            const name: string = $('em', item).text()
            const chapGroup: string = $(chapter).attr('class') ?? ''
            let chapNum: number = Number($('a', item).text().split(' ').pop())
            if (isNaN(chapNum)) {
                chapNum = 0
            }

            const language = $('html').attr('lang') ?? 'fr'
            const time = source.convertTime($('.action .date-chapter-title-rtl', chapter).text().trim())
            if (typeof chapterId === 'undefined') continue
            chapters.push(createChapter({
                id: chapterId,
                mangaId: mangaId,
                chapNum: chapNum,
                group: this.decodeHTMLEntity(chapGroup),
                langCode: reverseLangCode[language] ?? reverseLangCode['_unknown'],
                name: this.decodeHTMLEntity(name),
                time: time
            }))
        }
        return chapters
    }

    parseChapterDetails($: CheerioSelector): string[] {
        const pages: string[] = []
        
        // Get all of the pages
        const allItems = $('div[id="all"] img', '.col-sm-8').toArray();
        for(const item of allItems)
        {
            const page = $(item).attr('data-src')?.replace(' //', 'https://').trim();
            // If page is undefined, dont push it
            if (typeof page === 'undefined')
                continue;

            pages.push(page);
        }

        return pages
    }

    filterUpdatedManga($: CheerioSelector, time: Date, ids: string[], source: any): { updates: string[], loadNextPage: boolean } {
        const foundIds: string[] = []
        let passedReferenceTime = false
        const panel = $('.mangalist');
        const allItems = $('.manga-item', panel).toArray();

        for (const item of allItems) {
            const url = $('a', item).first().attr('href');
            const urlSplit = url?.split('/');
            const id = urlSplit?.pop();
            if (typeof id === 'undefined') continue

            const mangaTime = source.convertTime($('.pull-right', item).text().trim())
            passedReferenceTime = mangaTime <= time
            if (!passedReferenceTime) {
                if (ids.includes(id)) {
                    foundIds.push(id)
                }
            } else break
        }
        if (!passedReferenceTime) {
            return {updates: foundIds, loadNextPage: true}
        } else {
            return {updates: foundIds, loadNextPage: false}
        }


    }

    parseSearchResults(data: any, source: any, search: string): MangaTile[] {
        const mangaTiles: MangaTile[] = []
        const obj = JSON.parse(data)

        for(const entry of obj.suggestions) {
            if(entry.value.toLowerCase().includes(search)) {
                const image = `${LM_DOMAIN}/uploads/manga/${entry.data}/cover/cover_250x350.jpg`
                const title = entry.value

                mangaTiles.push(createMangaTile({
                    id: entry.data,
                    title: createIconText({text: source.parseString(title)}),
                    image: image
                }))
            }
        }
        return mangaTiles
    }

    parseTags($: CheerioSelector): TagSection[] {

        const tagSections: TagSection[] = [createTagSection({id: '0', label: 'genres', tags: []})]
        
        const allItems = $('.tag-links a').toArray()
        for (const item of allItems) {
            const label = $(item).text().trim()
            tagSections[0].tags.push(createTag({id: label, label: label}))
        }
        return tagSections
    }

    parseHomePageSection($: CheerioSelector, source: any): MangaTile[] {

        let tiles: MangaTile[] = []
        let collectedIds: string[] = []
        for (let item of $('.item', $('#series-list')).toArray()) {
            let id = $('a', item).attr('href')?.replace(`/series/`, '')!.trim().split('/')[0] ?? ''
            let titleText = this.decodeHTMLEntity($('.item-title', $(item)).text())
            let subtitle = $('.visited', $(item)).text().trim()
            let time = source.convertTime($('i', $(item)).text().trim())
            let image = $('img', $(item)).attr('src')

            if (typeof id === 'undefined' || typeof image === 'undefined') continue
            if (!collectedIds.includes(id)) {
                tiles.push(createMangaTile({
                    id: id,
                    title: createIconText({text: titleText}),
                    subtitleText: createIconText({text: subtitle}),
                    primaryText: createIconText({text: time.toDateString(), icon: 'clock.fill'}),
                    image: image
                }))
                collectedIds.push(id)
            }
        }
        return tiles
    }

    isLastPage($: CheerioSelector): boolean {
        return $('.page-item').last().hasClass('disabled');

    }

    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, function (match, dec) {
            return String.fromCharCode(dec);
        })
    }

}
