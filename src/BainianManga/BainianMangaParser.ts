import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common";

const BM_IMAGE_DOMAIN = 'https://img.lxhy88.com'

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
    const json = $('[type=application\\/ld\\+json]').html()?.replace(/\t*\n*/g, '') ?? ''
    const parsedJson = JSON.parse(json)

    const infoElement = $('div.data')
    const title = parsedJson.title
    const image = parsedJson.images[0]
    let author = $('.dir', infoElement).text().trim().replace('作者：', '')
    let artist = ''
    let rating = 0
    let status = $('span.list_item ').text() == '连载中' ? MangaStatus.ONGOING : MangaStatus.COMPLETED
    let titles = [title]
    let follows = 0
    let views = 0
    let lastUpdate = ''
    let hentai = false

    const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] })]
    
    const elems = $('.yac', infoElement).find('a').toArray()
    for (const elem of elems) {
        const text = $(elem).text()
        const id = (($(elem).attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
        if (text.toLowerCase().includes('biantai')) { // No hentai on BainianManga
            hentai = true
        }
        tagSections[0].tags.push(createTag({ id: id, label: text }))
    }

    const time = new Date(parsedJson.upDate)
    lastUpdate = time.toDateString()

    const summary = parsedJson.description

    return createManga({
        id: mangaId,
        titles,
        image,
        rating: Number(rating),
        status,
        artist,
        author,
        tags: tagSections,
        views,
        follows,
        lastUpdate,
        desc: summary,
        hentai
    })
}


export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    const allChapters = $('li', '.list_block ').toArray()
    const chapters: Chapter[] = []
    let index
    for (let chapter of allChapters) {
        const id: string = ( $('a', chapter).attr('href')?.split('/').pop() ?? '' ).replace('.html', '')
        const name: string = $('a', chapter).text() ?? ''
        let tempChapNum: number = Number(name.match(/\d+/) ?? 0 )

        if (tempChapNum == 0)
        {
            index = allChapters.indexOf(chapter)
            if (index < allChapters.length - 1)
            {
                const nextName: string = $('a', allChapters[index+1]).text() ?? ''
                tempChapNum = Number(nextName.match(/\d+/) ?? 0 ) + 0.5
            }
        }

        const chapNum: number = tempChapNum
        const time: Date = new Date($('.chapter-time', chapter).attr('title') ?? '')
        chapters.push(createChapter({
            id,
            mangaId,
            name,
            langCode: LanguageCode.CHINEESE,
            chapNum,
            time
        }))
    }
    return chapters
}


export const parseChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string, { data }: any): ChapterDetails => {
    const baseImageURL = data?.match(/var z_img='(.*?)';/)?.pop()
    const imageCode = data?.match(/var z_img='(.*?)';/)?.pop()

    let pages : string[] = []
    if (imageCode) {
        const imagePaths = JSON.parse(imageCode) as string[]
        pages = imagePaths.map(imagePath => `${BM_IMAGE_DOMAIN}${imagePath}`)
    }
    console.log(pages)

    return createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages,
        longStrip: false
    })
}


export interface UpdatedManga {
    ids: string[];
    loadMore: boolean;
}


export const parseUpdatedManga = ($: CheerioStatic, time: Date, ids: string[]): UpdatedManga => {
    const foundIds: string[] = []
    let passedReferenceTime = false
    const panel = $('.tbox_m')
    const allItems = $('.vbox', panel).toArray()
    for (const item of allItems) {
        const id = (($('a', item).first().attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
        let mangaTime = new Date($($(item).find('h4')[1]).text())

        passedReferenceTime = mangaTime > time
        if (passedReferenceTime) {
            if (ids.includes(id)) {
                foundIds.push(id)
            }
        }
        else break
    }

    return {
        ids: foundIds,
        loadMore: passedReferenceTime
    }
}


export const parseHomeSections = ($: CheerioStatic, section: HomeSection, sectionCallback: (section: HomeSection) => void): void => {
    sectionCallback(section)
    const recommendedManga: MangaTile[] = []

    // Recommended
    const grid = $('.tbox_m')[0]
    const allItems = $('.vbox', grid).toArray()
    for (const item of allItems) {
        const id = (($('a', item).first().attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
        const title = $('.vbox_t', item).attr('title') ?? 'No title'
        const subtitle = $('.vbox_t span', item).text()
        const image = $('.vbox_t mip-img', item).attr('src') ?? ''

        recommendedManga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle })
        }))
    }

    section.items = recommendedManga

    // Perform the callbacks again now that the home page sections are filled with data
    sectionCallback(section)
}


export const parseHotManga = ($: CheerioStatic, section: HomeSection, sectionCallback: (section: HomeSection) => void): void => {
    sectionCallback(section)
    const hotManga: MangaTile[] = []

    // New
    const grid = $('.tbox_m')[0]
    const allItems = $('.vbox', grid).toArray()
    for (const item of allItems) {
        const id = (($('a', item).first().attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
        const title = $('.vbox_t', item).attr('title') ?? 'No title'
        const subtitle = $('.vbox_t span', item).text()
        const image = $('.vbox_t mip-img', item).attr('src') ?? ''

        hotManga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle })
        }))
    }

    section.items = hotManga

    // Perform the callbacks again now that the home page sections are filled with data
    sectionCallback(section)
}


export const parseNewManga = ($: CheerioStatic, section: HomeSection, sectionCallback: (section: HomeSection) => void): void => {
    sectionCallback(section)
    const newManga: MangaTile[] = []

    // New
    const grid = $('.tbox_m')[0]
    const allItems = $('.vbox', grid).toArray()
    for (const item of allItems) {
        const id = (($('a', item).first().attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
        const title = $('.vbox_t', item).attr('title') ?? 'No title'
        const subtitle = $('.vbox_t span', item).text()
        const image = $('.vbox_t mip-img', item).attr('src') ?? ''

        newManga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle })
        }))
    }

    section.items = newManga

    // Perform the callbacks again now that the home page sections are filled with data
    sectionCallback(section)
}


export const generateSearch = (query: SearchRequest): string => {

    let keyword = (query.title ?? '').replace(/ /g, '+')
    if (query.author)
        keyword += (query.author ?? '').replace(/ /g, '+')
    let search: string = `${keyword}`

    return search
}


export const parseSearch = ($: CheerioStatic): MangaTile[] => {
    const panel = $('.tbox_m')
    const allItems = $('.vbox', panel).toArray()
    const manga: MangaTile[] = []
    for (const item of allItems) {
        const id = (($('a', item).first().attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
        const title = $('.vbox_t', item).attr('title') ?? 'No title'
        const subtitle = $('.vbox_t span', item).text()
        const image = $('.vbox_t mip-img', item).attr('src') ?? ''

        manga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
        }))
    }
    return manga
}


export const parseTags = ($: CheerioStatic): TagSection[] | null => {
    const allItems = $('.tbox a').toArray()
    const genres = createTagSection({
        id: 'genre',
        label: 'Genre',
        tags: []
    })
    for (let item of allItems) {
        let id = ($(item).attr('href')?.split('/').pop() ?? '').replace('.html', '')
        let label = $(item).text()
        genres.tags.push(createTag({ id: id, label: label }))
    }
    return [genres]
}


export const parseViewMore = ($: CheerioStatic): MangaTile[] => {
    const panel = $('.tbox_m')
    const allItems = $('.vbox', panel).toArray()
    const manga: MangaTile[] = []
    for (const item of allItems) {
        const id = (($('a', item).first().attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
        const title = $('.vbox_t', item).attr('title') ?? 'No title'
        const subtitle = $('.vbox_t span', item).text()
        const image = $('.vbox_t mip-img', item).attr('src') ?? ''

        manga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
        }))
    }
    return manga
}


export const isLastPage = ($: CheerioStatic): boolean => {
    const pagenav = $('.pagination')
    let disabled = $(pagenav).find('.disabled').length > 0

    return disabled
}