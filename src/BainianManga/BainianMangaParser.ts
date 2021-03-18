import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common";


export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
    const imageElement = $('div.img')
    const infoElement = $('div.data')
    const title = $('h4', infoElement).text() ?? 'No title'
    const image = $('.mip-fill-content', imageElement).attr('src') ?? ''
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
        const id = $(elem).attr('href')?.split('/').pop()?.split('-').pop() ?? ''
        if (text.toLowerCase().includes('biantai.html')) { // No hentai on BainianManga
            hentai = true
        }
        tagSections[0].tags.push(createTag({ id: id, label: text }))
    }

    const time = new Date($('.act', infoElement).text().split('  /  ')[0].replace('更新：', ''))
    lastUpdate = time.toDateString()

    const summary = $('div.tbox_js').text().trim()

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
        let tempChapNum: number = Number((name.match(/^第(\d+)/) ?? [0,0] )[1])

        if (tempChapNum == 0)
        {
            index = allChapters.indexOf(chapter)
            if (index < allChapters.length - 1)
            {
                const nextName: string = $('a', allChapters[index+1]).text() ?? ''
                tempChapNum = Number((nextName.match(/^第(\d+)/) ?? [0,0] )[1]) + 0.5
            }
        }

        const chapNum: number = tempChapNum
        const time: Date = new Date($('.chapter-time', chapter).attr('title') ?? '')
        chapters.push(createChapter({
            id,
            mangaId,
            name,
            langCode: LanguageCode.ENGLISH,
            chapNum,
            time
        }))
    }
    return chapters
}


export const parseChapterPageDetails = ($: CheerioStatic): string => {
    const image = $('img').attr('src') ?? ''
    
    return image
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

// TODO
export const parseHomeSections = ($: CheerioStatic, sections: HomeSection[], sectionCallback: (section: HomeSection) => void): void => {
    for (const section of sections) sectionCallback(section)
    const topManga: MangaTile[] = []
    const updateManga: MangaTile[] = []
    const newManga: MangaTile[] = []

    for (const item of $('.item', '.owl-carousel').toArray()) {
      const id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
      const image = $('img', item).attr('src') ?? ''
      topManga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: $('a', item).first().text() }),
        subtitleText: createIconText({ text: $('[rel=nofollow]', item).text() })
      }))
    }

    for (const item of $('.content-homepage-item', '.panel-content-homepage').toArray()) {
      const id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
      const image = $('img', item).attr('src') ?? ''
      const itemRight = $('.content-homepage-item-right', item)
      const latestUpdate = $('.item-chapter', itemRight).first()
      updateManga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: $('a', itemRight).first().text() }),
        subtitleText: createIconText({ text: $('.item-author', itemRight).text() }),
        primaryText: createIconText({ text: $('.genres-item-rate', item).text(), icon: 'star.fill' }),
        secondaryText: createIconText({ text: $('i', latestUpdate).text(), icon: 'clock.fill' })
      }))
    }

    for (const item of $('a', '.panel-newest-content').toArray()) {
      const id = $(item).attr('href')?.split('/').pop() ?? ''
      const image = $('img', item).attr('src') ?? ''
      const title = $('img', item).attr('alt') ?? ''
      newManga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title })
      }))
    }

    sections[0].items = topManga
    sections[1].items = updateManga
    sections[2].items = newManga

    // Perform the callbacks again now that the home page sections are filled with data
    for (const section of sections) sectionCallback(section)
}


export const generateSearch = (query: SearchRequest): string => {

    let keyword = (query.title ?? '').replace(/ /g, '+')
    if (query.author)
      keyword += (query.author ?? '').replace(/ /g, '+')
    let search: string = `${keyword}`

    return search
}

// TODO
export const parseSearch = ($: CheerioStatic): MangaTile[] => {
    const panel = $('.tbox_m')
    const allItems = $('.vbox', panel).toArray()
    const manga: MangaTile[] = []
    for (const item of allItems) {
      const id = (($('a', item).first().attr('href') ?? '').split('/').pop() ?? '' ).replace('.html', '')
      const title = $('.vbox_t', item).attr('title')
      const subTitle = ''
      const image = $('.img-loading', item).attr('src') ?? ''
      const rating = $('.genres-item-rate', item).text()
      const updated = $('.genres-item-time', item).text()

      manga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title }),
        subtitleText: createIconText({ text: subTitle }),
        primaryText: createIconText({ text: rating, icon: 'star.fill' }),
        secondaryText: createIconText({ text: updated, icon: 'clock.fill' })
      }))
    }
    return manga
}

// TODO
export const parseTags = ($: CheerioStatic): TagSection[] | null => {
    const panel = $('.advanced-search-tool-genres-list')
    const genres = createTagSection({
      id: 'genre',
      label: 'Genre',
      tags: []
    })
    for (let item of $('span', panel).toArray()) {
      let id = $(item).attr('data-i') ?? ''
      let label = $(item).text()
      genres.tags.push(createTag({ id: id, label: label }))
    }
    return [genres]
}

// TODO
export const parseViewMore = ($: CheerioStatic): MangaTile[] => {
    const manga: MangaTile[] = []
    const panel = $('.panel-content-genres')
    for (const item of $('.content-genres-item', panel).toArray()) {
        const id = ($('a', item).first().attr('href') ?? '').split('/').pop() ?? ''
        const image = $('img', item).attr('src') ?? ''
        const title = $('.genres-item-name', item).text()
        const subtitle = $('.genres-item-chap', item).text()
        let time = new Date($('.genres-item-time').first().text())
        if (time > new Date(Date.now())) {
            time = new Date(Date.now() - 60000)
        }
        const rating = $('.genres-item-rate', item).text()
        manga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
            primaryText: createIconText({ text: rating, icon: 'star.fill' }),
            secondaryText: createIconText({ text: time.toDateString(), icon: 'clock.fill' })
        }))
    }
    return manga
}


export const isLastPage = ($: CheerioStatic): boolean => {
    const pagenav = $('.pagination')
    let disabled = $(pagenav).find('.disabled').length > 0

    return disabled
}