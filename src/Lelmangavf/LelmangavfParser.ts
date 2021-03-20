import {Chapter, Manga, MangaStatus, MangaTile, Tag, TagSection} from 'paperback-extensions-common'
import {reverseLangCode} from "./Languages"

const CryptoJS = require('./external/crypto.min.js')

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
        let chapters: Chapter[] = []
        let allChapters = $('.chapters li[class^="volume-"]').toArray()
        for (const chapter of allChapters) {
            const item = $('.chapter-title-rtl', chapter);
            const chapterId = $('a', item).attr('href');
            let name: string = $('em', item).text()
            let chapGroup: string = $(chapter).attr('class') ?? ''
            let chapNum: number = Number($('a', item).text().split(' ').pop())
            if (isNaN(chapNum)) {
                chapNum = 0
            }

            let language = $('html').attr('lang') ?? 'fr'
            let time = source.convertTime($('.action .date-chapter-title-rtl', chapter).text().trim())
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


    sortChapters(chapters: Chapter[]): Chapter[] {
        let sortedChapters: Chapter[] = []
        chapters.forEach((c) => {
            if (sortedChapters[sortedChapters.indexOf(c)]?.id !== c?.id) {
                sortedChapters.push(c)
            }
        })
        sortedChapters.sort((a, b) => (a.id > b.id) ? 1 : -1)
        return sortedChapters
    }


    parseChapterDetails($: CheerioSelector): string[] {
        let pages: string[] = []

        // Get all of the pages
        let scripts = $('script').toArray()
        for (let scriptObj of scripts) {
            let script = scriptObj.children[0]?.data
            if (typeof script === 'undefined') continue
            if (script.includes("var images =")) {
                let imgJson = JSON.parse(script.split('var images = ', 2)[1].split(";", 2)[0] ?? '') as any
                let imgNames = imgJson.names()

                if (imgNames != null) {
                    for (let i = 0; i < imgNames.length(); i++) {
                        let imgKey = imgNames.getString(i)
                        let imgUrl = imgJson.getString(imgKey)
                        pages.push(imgUrl)
                    }
                }

            } else if (script.includes("const server =")) {
                let encryptedServer = (script.split('const server = ', 2)[1].split(";", 2)[0] ?? '').replace(/"/g, "")
                let batoJS = eval(script.split('const batojs = ', 2)[1].split(";", 2)[0] ?? '').toString()
                let decryptScript = CryptoJS.AES.decrypt(encryptedServer, batoJS).toString(CryptoJS.enc.Utf8)
                let server = decryptScript.toString().replace(/"/g, '')
                let imgArray = JSON.parse(script.split('const images = ', 2)[1].split(";", 2)[0] ?? '') as any
                if (imgArray != null) {
                    if (script.includes('bato.to/images')) {
                        for (let i = 0; i < imgArray.length; i++) {
                            let imgUrl = imgArray[i]
                            pages.push(`${imgUrl}`)
                        }
                    } else {
                        for (let i = 0; i < imgArray.length; i++) {
                            let imgUrl = imgArray[i]
                            if (server.startsWith("http"))
                                pages.push(`${server}${imgUrl}`)
                            else
                                pages.push(`https:${server}${imgUrl}`)
                        }
                    }
                }
            }
        }

        return pages
    }

    filterUpdatedManga($: CheerioSelector, time: Date, ids: string[], source: any): { updates: string[], loadNextPage: boolean } {
        let foundIds: string[] = []
        let passedReferenceTime = false
        for (let item of $('.item', $('#series-list')).toArray()) {
            let id = $('a', item).attr('href')?.replace(`/series/`, '')!.trim().split('/')[0] ?? ''
            let mangaTime = source.convertTime($('i', item).text().trim())
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

    parseSearchResults($: CheerioSelector, source: any): MangaTile[] {
        let mangaTiles: MangaTile[] = []
        let collectedIds: string[] = []
        for (let obj of $('.item', $('#series-list')).toArray()) {
            let id = $('.item-cover', obj).attr('href')?.replace(`/series/`, '')!.trim().split('/')[0] ?? ''
            let titleText = this.decodeHTMLEntity($('.item-title', $(obj)).text())
            let subtitle = $('.visited', $(obj)).text().trim()
            let time = source.convertTime($('i', $(obj)).text().trim())
            let image = $('img', $(obj)).attr('src')

            if (typeof id === 'undefined' || typeof image === 'undefined') continue
            if (!collectedIds.includes(id)) {
                mangaTiles.push(createMangaTile({
                    id: id,
                    title: createIconText({text: titleText}),
                    subtitleText: createIconText({text: subtitle}),
                    primaryText: createIconText({text: time.toDateString(), icon: 'clock.fill'}),
                    image: image
                }))
                collectedIds.push(id)
            }
        }
        return mangaTiles
    }

    parseTags($: CheerioSelector): TagSection[] {

        let tagSections: TagSection[] = [createTagSection({id: '0', label: 'genres', tags: []})]

        for (let obj of $('filter-item', $('.filter-items').first()).toArray()) {
            let label = $('span', $(obj)).text().trim()
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
