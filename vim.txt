let mapleader=";"

syntax enable

set title
set number
set showcmd
set wildmenu
set path+=**
set noswapfile
set hidden

set ignorecase
set smartcase
set scrolloff=8

nnoremap j gj
nnoremap k gk

inoremap jk <esc>
nnoremap <leader>w :w<cr>
nnoremap <leader>l :!clear<cr>
nnoremap <space> i_<esc>r


set tabstop=4 softtabstop=4 shiftwidth=4
nnoremap <leader>2 :set tabstop=2 softtabstop=2 shiftwidth=2<cr>
nnoremap <leader>4 :set tabstop=4 softtabstop=4 shiftwidth=4<cr>
nnoremap <leader>8 :set tabstop=8 softtabstop=8 shiftwidth=8<cr>

autocmd FileType php	nnoremap <leader>t :!php -l % <cr>
autocmd FileType json	nnoremap <leader>t :!jsonlint-php % <cr>


