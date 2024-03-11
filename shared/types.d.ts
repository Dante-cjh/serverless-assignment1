// export type Language = 'English' | 'Frenc

export type Movie = {
    id: number,
    backdrop_path: string,
    genre_ids: number[ ],
    original_language: string,
    original_title: string,
    adult: boolean,
    overview: string,
    popularity: number,
    poster_path: string,
    release_date: string,
    title: string,
    video: boolean,
    vote_average: number,
    vote_count: number
}

export type MovieCast = {
    movieId: number;
    actorName: string;
    roleName: string;
    roleDescription: string;
};
// Used to validate the query string og HTTP Get requests
export type MovieCastMemberQueryParams = {
    movieId: string;
    actorName?: string;
    roleName?: string
}

export interface MovieReview {
    MovieId: number;
    ReviewerName: string;
    ReviewDate: string; // ISO 8601 format, e.g., "2023-10-20"
    Content: string;
    Rating: number; // integer, range 1-5
    TranslatedContent?: string; // 可选字段，包含翻译后的评论文本
    TranslationLanguage?: string; // 可选字段，表示翻译的目标语言代码
}

export interface AddMovieReviewRequest {
    MovieId: number;
    ReviewerName: string;
    Content: string;
    Rating: number;
}

export interface UpdateMovieReviewRequest {
    Content?: string;
    Rating?: number;
}

export interface MovieReviewsResponse {
    reviews: MovieReview[];
}

export interface SingleMovieReviewResponse {
    review: MovieReview;
}

// 翻译请求可以保留，用于明确请求翻译的动作和目标语言
export interface TranslationRequest {
    languageCode: string;
}

export type SignUpBody = {
    username: string;
    password: string;
    email: string
}

export type ConfirmSignUpBody = {
    username: string;
    code: string;
}

export type SignInBody = {
    username: string;
    password: string;
}