const board = document.getElementById('tabuleiro');
const squares = Array.from(board.children);
const turnIndicator = document.getElementById('turnIndicator');

let selectedIndex = null;
let possibleMoves = [];
let turn = 'branco';

// Controle de movimentos do rei e torres para roque
const movedPieces = {
    branco: { king: false, rookLeft: false, rookRight: false },
    preto: { king: false, rookLeft: false, rookRight: false }
};

// Guarda último movimento duplo de peão para en passant
let lastDoublePawnMove = null;

// ===== Funções utilitárias =====
function parsePiece(img) {
    if (!img) return null;
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const text = (src + ' ' + alt).toLowerCase();
    const color = /branc|branco|pecasbrancas/.test(text) ? 'branco' : 'preto';
    let type = null;
    if (text.includes('peao') || text.includes('peão')) type = 'pawn';
    else if (text.includes('torre')) type = 'rook';
    else if (text.includes('cavalo')) type = 'knight';
    else if (text.includes('bispo')) type = 'bishop';
    else if (text.includes('rainha')) type = 'queen';
    else if (text.includes('rei')) type = 'king';
    return type ? { type, color, img } : null;
}

function indexToRC(i) { return { r: Math.floor(i/8), c: i % 8 }; }
function rcToIndex(r,c) { return r*8 + c; }
function inBounds(r,c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function getPieceAt(index) { return parsePiece(squares[index].querySelector('img')); }
function setPieceAt(index, imgElement) { squares[index].innerHTML = ''; if (imgElement) squares[index].appendChild(imgElement); }
function cloneImg(img) { if (!img) return null; const clone = img.cloneNode(true); clone.removeAttribute('id'); return clone; }
function updateTurnIndicator() {
    const inCheck = isInCheck(turn);
    turnIndicator.textContent = `Vez: ${turn === 'branco' ? 'Branco' : 'Preto'}${inCheck ? ' - XEQUE!' : ''}`;
}

// ===== Geração de movimentos =====
function generateMoves(fromIdx) {
    const piece = getPieceAt(fromIdx);
    if (!piece) return [];
    const { r, c } = indexToRC(fromIdx);
    const moves = [];

    const pushIfValid = (tr, tc) => {
        if (!inBounds(tr, tc)) return false;
        const idx = rcToIndex(tr, tc);
        const target = getPieceAt(idx);
        if (!target) {
            moves.push({ to: idx, capture: false });
            return true;
        } else if (target.color !== piece.color) {
            moves.push({ to: idx, capture: true });
            return false;
        } else return false;
    };

    if (piece.type === 'pawn') {
        const dir = piece.color === 'branco' ? -1 : 1;
        const startRow = piece.color === 'branco' ? 6 : 1;

        if (!getPieceAt(rcToIndex(r+dir, c))) {
            moves.push({ to: rcToIndex(r+dir, c), capture: false });
            if (r === startRow && !getPieceAt(rcToIndex(r+2*dir, c))) {
                moves.push({ to: rcToIndex(r+2*dir, c), capture: false, doubleMove: true });
            }
        }

        for (const dc of [-1,1]) {
            const tr = r+dir, tc = c+dc;
            if (inBounds(tr, tc)) {
                const idx = rcToIndex(tr, tc);
                const target = getPieceAt(idx);
                if (target && target.color !== piece.color) moves.push({ to: idx, capture: true });
            }
        }

        if(lastDoublePawnMove){
            const { from, to } = lastDoublePawnMove;
            const { r: fr, c: fc } = indexToRC(from);
            const { r: tr, c: tc } = indexToRC(to);
            if(r === tr && Math.abs(c - tc) === 1){
                const epRow = r + dir;
                moves.push({ to: rcToIndex(epRow, tc), capture: true, enPassant: true, epTarget: to });
            }
        }
    }

    if (piece.type === 'rook' || piece.type === 'queen') {
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        for (const [dr,dc] of dirs) {
            let tr=r+dr, tc=c+dc;
            while(inBounds(tr,tc)){ if(!pushIfValid(tr,tc)) break; tr+=dr; tc+=dc; }
        }
    }

    if (piece.type === 'bishop' || piece.type === 'queen') {
        const dirs=[[1,1],[1,-1],[-1,1],[-1,-1]];
        for(const [dr,dc] of dirs){ let tr=r+dr, tc=c+dc; while(inBounds(tr,tc)){ if(!pushIfValid(tr,tc)) break; tr+=dr; tc+=dc; } }
    }

    if (piece.type === 'knight') {
        const deltas=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for(const [dr,dc] of deltas){ const tr=r+dr, tc=c+dc; if(!inBounds(tr,tc)) continue; const idx=rcToIndex(tr,tc); const target=getPieceAt(idx); if(!target||target.color!==piece.color) moves.push({to:idx,capture:!!target}); }
    }

    if (piece.type === 'king') {
        for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ if(dr===0&&dc===0) continue; const tr=r+dr, tc=c+dc; if(!inBounds(tr,tc)) continue; const idx=rcToIndex(tr,tc); const target=getPieceAt(idx); if(!target||target.color!==piece.color) moves.push({to:idx,capture:!!target}); }

        if(!movedPieces[piece.color].king){
            const row = piece.color==='branco'?7:0;
            if(!movedPieces[piece.color].rookLeft &&
               !getPieceAt(rcToIndex(row,1)) && !getPieceAt(rcToIndex(row,2)) && !getPieceAt(rcToIndex(row,3))){
                moves.push({to:rcToIndex(row,2), castle:'queen'});
            }
            if(!movedPieces[piece.color].rookRight &&
               !getPieceAt(rcToIndex(row,5)) && !getPieceAt(rcToIndex(row,6))){
                moves.push({to:rcToIndex(row,6), castle:'king'});
            }
        }
    }

    return moves;
}

// ===== Detecção de Xeque =====
function isInCheck(color){
    // Encontra rei da cor
    let kingIdx = squares.findIndex(sq=>{
        const piece = getPieceAt(sq.querySelector('img'));
        return piece && piece.type==='king' && piece.color===color;
    });
    if(kingIdx===-1) return false;

    // Verifica se alguma peça adversária pode capturar o rei
    for(let i=0;i<64;i++){
        const piece = getPieceAt(i);
        if(piece && piece.color!==color){
            const moves = generateMoves(i);
            if(moves.some(m=>m.to===kingIdx)) return true;
        }
    }
    return false;
}

// ===== UI =====
function clearHighlights(){
    squares.forEach(s=>s.classList.remove('highlight','selected','captura','castle'));
}
function highlightMoves(fromIdx,moves){
    clearHighlights();
    squares[fromIdx].classList.add('selected');
    for(const mv of moves){
        squares[mv.to].classList.add(mv.castle ? 'castle' : mv.capture ? 'captura' : 'highlight');
    }
}

// ===== Movimentação com animação =====
function makeMove(fromIdx,toIdx,castle=null,enPassantTarget=null,doubleMove=false){
    const fromImg = squares[fromIdx].querySelector('img');
    const targetImg = squares[toIdx].querySelector('img');
    const piece = parsePiece(fromImg);
    if(!piece) return;

    const movedImg = cloneImg(fromImg);

    const { r: toR } = indexToRC(toIdx);
    if(piece.type==='pawn' && ((piece.color==='branco' && toR===0)||(piece.color==='preto' && toR===7))){
        const src = piece.color==='branco'? './imgs/PecasBrancas/rainhaBranca.jpg':'./imgs/PrecasPreta/rainhaPreta.jpg';
        movedImg.setAttribute('src',src);
        movedImg.setAttribute('alt',piece.color==='branco'?'rainha branca':'rainha preta');
    }

    setPieceAt(toIdx,movedImg);
    squares[fromIdx].innerHTML='';

    if(targetImg){ targetImg.classList.add('captured'); setTimeout(()=>targetImg.remove(),300); }

    if(enPassantTarget !== null){
        const epImg = squares[enPassantTarget].querySelector('img');
        if(epImg){ epImg.classList.add('captured'); setTimeout(()=>epImg.remove(),300); }
        squares[enPassantTarget].innerHTML='';
    }

    if(piece.type==='king') movedPieces[piece.color].king = true;
    if(piece.type==='rook'){
        const {c} = indexToRC(fromIdx);
        if(c===0) movedPieces[piece.color].rookLeft=true;
        if(c===7) movedPieces[piece.color].rookRight=true;
    }

    if(castle){
        const row = piece.color==='branco'?7:0;
        if(castle==='king'){
            const rookFrom = rcToIndex(row,7);
            const rookTo = rcToIndex(row,5);
            const rookImg = squares[rookFrom].querySelector('img');
            setPieceAt(rookTo, cloneImg(rookImg));
            squares[rookFrom].innerHTML='';
            movedPieces[piece.color].rookRight=true;
        } else if(castle==='queen'){
            const rookFrom = rcToIndex(row,0);
            const rookTo = rcToIndex(row,3);
            const rookImg = squares[rookFrom].querySelector('img');
            setPieceAt(rookTo, cloneImg(rookImg));
            squares[rookFrom].innerHTML='';
            movedPieces[piece.color].rookLeft=true;
        }
    }

    lastDoublePawnMove = doubleMove ? { from: fromIdx, to: toIdx } : null;
}

// ===== Eventos de clique =====
squares.forEach((sq, idx)=>{
    sq.addEventListener('click', ()=>{
        const clickedPiece = getPieceAt(idx);
        const move = possibleMoves.find(m=>m.to===idx);

        if(selectedIndex!==null && move){
            makeMove(selectedIndex, idx, move.castle, move.enPassant ? move.epTarget : null, move.doubleMove);
            selectedIndex=null;
            possibleMoves=[];
            clearHighlights();
            turn=(turn==='branco')?'preto':'branco';
            setTimeout(updateTurnIndicator,300);
            return;
        }

        if(clickedPiece && clickedPiece.color===turn){
            selectedIndex=idx;
            possibleMoves=generateMoves(idx);
            highlightMoves(idx,possibleMoves);
            return;
        }

        selectedIndex=null;
        possibleMoves=[];
        clearHighlights();
    });
});

updateTurnIndicator();
